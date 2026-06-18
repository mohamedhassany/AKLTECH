import io
import re
from datetime import datetime, timedelta 
import datetime as dt
import random
from flask import Flask, request, jsonify, send_file
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_cors import CORS
from werkzeug.security import generate_password_hash
import pyodbc
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.pagesizes import A4
from werkzeug.security import check_password_hash
from ai_prophet import get_ai_forecasts

app = Flask(__name__)
CORS(app)
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://", # تخزين المحاولات في الذاكرة
)
DB_CONFIG = {
    "DRIVER": "{ODBC Driver 17 for SQL Server}",
    "SERVER": "db33942.public.databaseasp.net,1433",
    "DATABASE": "db33942",
    "UID": "db33942",
    "PWD": "project2026",
    "Encrypt": "yes",
    "TrustServerCertificate": "yes"
}

def get_connection():
    conn_str = ";".join([f"{k}={v}" for k, v in DB_CONFIG.items()])
    return pyodbc.connect(conn_str, autocommit=True)

# -------------------------
# LOGIN
# -------------------------
@app.route('/login', methods=['POST'])
# 2. تحديد حد أقصى: 5 محاولات فقط كل دقيقة لكل IP
@limiter.limit("5 per minute", error_message="لقد تجاوزت عدد المحاولات المسموح بها، حاول بعد دقيقة.")
def login():
    data = request.json
    if not data:
        return jsonify({"success": False, "message": "بيانات غير صالحة"}), 400

    username = data.get('username')
    password = data.get('password') 

    if not username or not password:
        return jsonify({"success": False, "message": "يرجى إدخال اسم المستخدم وكلمة السر"}), 400

    try:
        with get_connection() as conn:
            # استخدام Query بارامتري لمنع الـ SQL Injection
            row = conn.cursor().execute("""
                SELECT U.password as stored_password, S.STAFF_ID, S.name, S.role 
                FROM Staff_Users U 
                JOIN STAFF S ON U.STAFF_ID = S.STAFF_ID 
                WHERE U.username = ?
            """, (username,)).fetchone()

        if row:
            stored_password = row.stored_password
            
            # 3. التحقق من كلمة السر
            valid_password = False
            
            if any(stored_password.startswith(prefix) for prefix in ['scrypt', 'pbkdf2', 'sha256']):
                if check_password_hash(stored_password, password):
                    valid_password = True
            elif stored_password == password:
                valid_password = True

            if valid_password:
                return jsonify({
                    "success": True, 
                    "staff_id": row.STAFF_ID, 
                    "name": row.name, 
                    "role": row.role
                })

        return jsonify({"success": False, "message": "اسم المستخدم أو كلمة السر غير صحيحة"}), 401

    except Exception as e:
        print(f"Login Error: {e}")
        return jsonify({"success": False, "message": "حدث خطأ في النظام، يرجى المحاولة لاحقاً"}), 500

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({"success": False, "message": "تخطي5 محاولات. يرجى الانتظار قليلاً"}), 429

# -------------------------
# CHANGE PASSWORD 
# -------------------------
@app.route('/manager/change-password', methods=['POST'])
def change_password():
    data = request.json
    old = data.get('old_password')
    new = data.get('new_password')
    staff_id = data.get('staff_id')

    if not old or not new or not staff_id:
        return jsonify({"success": False, "message": "Missing data"}), 400

    if not isinstance(new, str) or len(new) < 8:
        return jsonify({"success": False, "message": "New password must be at least 8 characters long"}), 400

    password_regex = r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$'
    if not re.match(password_regex, new):
        return jsonify({"success": False, "message": "Password must contain uppercase, lowercase, number, and special character"}), 400

    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            row = cursor.execute("SELECT password FROM Staff_Users WHERE STAFF_ID=?", (staff_id,)).fetchone()
            if not row:
                return jsonify({"success": False, "message": "User not found"}), 404

            stored_pass = row.password
            is_valid = check_password_hash(stored_pass, old) if stored_pass.startswith(('scrypt:', 'pbkdf2:', 'sha256:')) else (stored_pass == old)
            if not is_valid:
                return jsonify({"success": False, "message": "Old password incorrect"}), 401

            new_hashed = generate_password_hash(new)
            cursor.execute("UPDATE Staff_Users SET password=? WHERE STAFF_ID=?", (new_hashed, staff_id))
            conn.commit()

        return jsonify({"success": True, "message": "Password changed successfully"})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# -------------------------
# MAIN OVERVIEW
# -------------------------
@app.route('/manager/main-overview', methods=['GET'])
def main_overview():
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            
            res = cursor.execute("""
                SELECT COUNT(*), ISNULL(SUM(total), 0)
                FROM [ORDER]
                WHERE CAST(ordered_at AS DATE) = CAST(GETDATE() AS DATE)
                AND status != 'Cancelled'
            """).fetchone()
            total_orders = res[0]
            total_sales = float(res[1])
            
            res_res = cursor.execute("""
                SELECT COUNT(*) 
                FROM RESERVATION
                WHERE CAST(reserve_time AS DATE) = CAST(GETDATE() AS DATE)
                AND status NOT IN ('Cancelled')
            """).fetchone()
            active_reservations = res_res[0] if res_res else 0
            
            res_fb = cursor.execute("""
                SELECT COUNT(*), ISNULL(AVG(CAST(rating AS FLOAT)), 0)
                FROM FEEDBACKS
            """).fetchone()
            total_feedback = res_fb[0] if res_fb else 0
            avg_rating = round(float(res_fb[1]), 1) if res_fb else 0
            
            peak_hours = {h: 0 for h in range(10, 23)}
            raw_peak = cursor.execute("""
                SELECT DATEPART(HOUR, ordered_at), COUNT(*)
                FROM [ORDER]
                WHERE CAST(ordered_at AS DATE) = CAST(GETDATE() AS DATE)
                AND status != 'Cancelled'
                GROUP BY DATEPART(HOUR, ordered_at)
            """).fetchall()
            for r in raw_peak:
                if r[0] is not None and 10 <= r[0] <= 22:
                    peak_hours[r[0]] = r[1]
                    
            weekly = []
            today_date = datetime.today()
            
            for i in range(6, -1, -1):
                target_date = today_date - timedelta(days=i)
                day_name = target_date.strftime("%a")
                
                sum_data = cursor.execute(f"""
                    SELECT ISNULL(SUM(total), 0)
                    FROM [ORDER]
                    WHERE CAST(ordered_at AS DATE) = CAST(DATEADD(DAY, -{i}, GETDATE()) AS DATE)
                    AND status != 'Cancelled'
                """).fetchone()
                
                revenue = float(sum_data[0]) if sum_data else 0
                weekly.append({
                    "day": day_name,
                    "revenue": revenue
                })
                
            types = cursor.execute("""
                SELECT order_type, COUNT(*)
                FROM [ORDER]
                WHERE CAST(ordered_at AS DATE) = CAST(GETDATE() AS DATE)
                GROUP BY order_type
            """).fetchall()
            
            type_dict = {}
            for t in types:
                if t[0] is not None:
                    key = str(t[0]).lower().replace('-', '').replace('_', '').replace(' ', '')
                    type_dict[key] = type_dict.get(key, 0) + t[1]
                    
            order_types = {
                "dinein": type_dict.get('dinein', 0),
                "takeaway": type_dict.get('takeaway', 0),
                "delivery": type_dict.get('delivery', 0),
                "reservation": type_dict.get('reservation', 0)
            }

        return jsonify({
            "success": True,
            "total_orders": total_orders,
            "total_sales": total_sales,
            "active_reservations": active_reservations,
            "total_feedback": total_feedback,
            "avg_rating": avg_rating,
            "peak_hours": [{"hour": k, "orders": v} for k, v in peak_hours.items()],
            "weekly_revenue": weekly,
            "order_types": order_types
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)})

# -------------------------
# ORDERS PERFORMANCE
# -------------------------
@app.route('/manager/orders-performance', methods=['GET'])
def orders_performance():
    try:
        filter_type = request.args.get("filter", "today")

        conn = get_connection()
        cursor = conn.cursor()

        if filter_type == "today":
            date_condition = "WHERE CAST(o.ordered_at AS DATE) = CAST(GETDATE() AS DATE)"
        elif filter_type == "week":
            date_condition = "WHERE DATEPART(WEEK, o.ordered_at) = DATEPART(WEEK, GETDATE()) AND DATEPART(YEAR, o.ordered_at)=DATEPART(YEAR, GETDATE())"
        elif filter_type == "month":
            date_condition = "WHERE MONTH(o.ordered_at) = MONTH(GETDATE()) AND YEAR(o.ordered_at)=YEAR(GETDATE())"
        else:
            date_condition = "WHERE 1=1"

        cursor.execute(f"""
            SELECT 
                ISNULL(
                    (COUNT(CASE WHEN updated_at <= expected_time AND status='Done' THEN 1 END) * 100.0)
                    /
                    NULLIF(COUNT(CASE WHEN status='Done' THEN 1 END),0)
                , 0)
            FROM [ORDER] o
            {date_condition}
        """)
        on_time = round(cursor.fetchone()[0] or 0, 0)

        cursor.execute(f"""
            SELECT ISNULL(AVG(DATEDIFF(MINUTE, ordered_at, expected_time)),0)
            FROM [ORDER] o
            {date_condition} AND status='Done'
        """)
        avg_prep = round(cursor.fetchone()[0] or 0, 0)

        cursor.execute(f"""
            SELECT COUNT(*) FROM [ORDER] o
            {date_condition} AND status='Preparing'
        """)
        active_orders = cursor.fetchone()[0]

        cursor.execute(f"""
            SELECT COUNT(*) FROM [ORDER] o
            {date_condition} AND status='Cancelled'
        """)
        cancelled_today = cursor.fetchone()[0]

        cursor.execute(f"""
            SELECT 
                o.ORDER_ID,
                o.order_type AS type,
                o.status,
                o.total,
                o.notes,
                o.expected_time,
                o.ordered_at,
                s.name AS cashier_name,
                t.name_or_number,
                STRING_AGG(m.name, ', ') AS items
            FROM [ORDER] o
            LEFT JOIN STAFF s ON o.STAFF_ID = s.STAFF_ID
            LEFT JOIN [TABLE] t ON o.TABLE_ID = t.TABLE_ID
            LEFT JOIN ORDER_ITEM oi ON o.ORDER_ID = oi.ORDER_ID
            LEFT JOIN MENU_ITEM m ON oi.MENU_ITEM_ID = m.MENU_ITEM_ID
            {date_condition}
            GROUP BY 
                o.ORDER_ID,
                o.order_type,
                o.status,
                o.total,
                o.notes,
                o.expected_time,
                o.ordered_at,
                s.name,
                t.name_or_number
            ORDER BY o.ORDER_ID DESC
        """)

        columns = [column[0] for column in cursor.description]
        orders = [dict(zip(columns, row)) for row in cursor.fetchall()]

        conn.close()

        return jsonify({
            "success": True,
            "kpis": {
                "on_time": on_time,
                "avg_prep": avg_prep,
                "active_orders": active_orders,
                "cancelled_today": cancelled_today
            },
            "orders": orders
        })

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# --------------------------------------
# REPORTS
# --------------------------------------
@app.route('/manager/reports', methods=['GET'])
def get_reports():
    try:
        target_month = request.args.get('month') 
        if not target_month:
            target_month = datetime.now().strftime('%Y-%m')
            
        target_year = target_month.split('-')[0]
        target_m = target_month.split('-')[1]

        with get_connection() as conn:
            cursor = conn.cursor()
            status_filter = "status NOT IN ('New','Cancelled')"
            
            curr_month_filter = f"{status_filter} AND FORMAT(ordered_at, 'yyyy-MM') = '{target_month}'"
            
            y = int(target_year)
            m = int(target_m)
            if m == 1:
                prev_m = 12
                prev_y = y - 1
            else:
                prev_m = m - 1
                prev_y = y
            prev_month_str = f"{prev_y}-{prev_m:02d}"
            prev_month_filter = f"{status_filter} AND FORMAT(ordered_at, 'yyyy-MM') = '{prev_month_str}'"

            curr_stats = cursor.execute(f"SELECT ISNULL(SUM(total),0), COUNT(*), ISNULL(SUM(discount_amount),0) FROM [ORDER] WHERE {curr_month_filter}").fetchone()
            month_revenue = float(curr_stats[0])
            month_orders = curr_stats[1]
            month_discounts = float(curr_stats[2])
            aov = month_revenue / month_orders if month_orders > 0 else 0

            prev_stats = cursor.execute(f"SELECT ISNULL(SUM(total),0), COUNT(*) FROM [ORDER] WHERE {prev_month_filter}").fetchone()
            prev_revenue = float(prev_stats[0])
            prev_orders = prev_stats[1]

            rev_growth = ((month_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue else 0
            ord_growth = ((month_orders - prev_orders) / prev_orders * 100) if prev_orders else 0

            fin_breakdown = cursor.execute(f"SELECT ISNULL(SUM(subtotal),0), ISNULL(SUM(tax),0), ISNULL(SUM(delivery_fee),0) FROM [ORDER] WHERE {curr_month_filter}").fetchone()
            finances = {
                "subtotal": float(fin_breakdown[0]),
                "tax": float(fin_breakdown[1]),
                "delivery": float(fin_breakdown[2]),
                "discount": month_discounts,
                "total": month_revenue
            }

            type_data = cursor.execute(f"SELECT ISNULL(order_type, 'Unknown'), ISNULL(SUM(total),0) FROM [ORDER] WHERE {curr_month_filter} GROUP BY order_type").fetchall()
            rev_by_type = {}
            for r in type_data:
                raw_type = str(r[0]).strip().lower().replace('_', '').replace('-', '')
                val = float(r[1])
                if 'dinein' in raw_type: c_type = 'Dine-in'
                elif 'takeaway' in raw_type: c_type = 'Take-away'
                elif 'delivery' in raw_type: c_type = 'Delivery'
                elif 'reservation' in raw_type: c_type = 'Reservation'
                else: c_type = 'Unknown'
                rev_by_type[c_type] = rev_by_type.get(c_type, 0) + val
            
            if 'Unknown' in rev_by_type and rev_by_type['Unknown'] == 0: 
                del rev_by_type['Unknown']
                
            valid_types = {k: v for k, v in rev_by_type.items() if k != 'Unknown'}
            top_type = max(valid_types, key=valid_types.get) if valid_types else "Not Specified Yet"

            size_data = cursor.execute(f"SELECT ISNULL(order_size, 'Unknown'), COUNT(*) FROM [ORDER] WHERE {curr_month_filter} GROUP BY order_size").fetchall()
            order_size = {}
            for r in size_data:
                raw_size = str(r[0]).strip().lower()
                val = int(r[1])
                if 'small' in raw_size: c_size = 'Small'
                elif 'med' in raw_size: c_size = 'Medium'
                elif 'large' in raw_size: c_size = 'Large'
                else: c_size = 'Unknown'
                order_size[c_size] = order_size.get(c_size, 0) + val
            
            if 'Unknown' in order_size and order_size['Unknown'] == 0: 
                del order_size['Unknown']

            popular_dishes = [{"name": r[0], "sold": r[1]} for r in cursor.execute(f"""
                SELECT TOP 5 M.name, SUM(OI.quantity) AS total_sold
                FROM ORDER_ITEM OI JOIN MENU_ITEM M ON OI.MENU_ITEM_ID=M.MENU_ITEM_ID JOIN [ORDER] O ON OI.ORDER_ID=O.ORDER_ID
                WHERE O.{curr_month_filter} GROUP BY M.name ORDER BY total_sold DESC
            """).fetchall()]

            bottom_dishes = [{"name": r[0], "sold": int(r[1])} for r in cursor.execute(f"""
                SELECT TOP 5 M.name, ISNULL(SUM(OI.quantity), 0) AS total_sold
                FROM MENU_ITEM M
                LEFT JOIN ORDER_ITEM OI ON M.MENU_ITEM_ID = OI.MENU_ITEM_ID
                LEFT JOIN [ORDER] O ON OI.ORDER_ID = O.ORDER_ID AND O.status NOT IN ('New','Cancelled') AND FORMAT(O.ordered_at, 'yyyy-MM') = '{target_month}'
                GROUP BY M.name
                ORDER BY total_sold ASC, M.name ASC
            """).fetchall()]

            best_month_row = cursor.execute(f"""
                SELECT TOP 1 FORMAT(ordered_at,'yyyy-MM'), SUM(total)
                FROM [ORDER] WHERE {status_filter}
                GROUP BY FORMAT(ordered_at,'yyyy-MM') ORDER BY SUM(total) DESC
            """).fetchone()
            
            best_month = best_month_row[0] if best_month_row else "N/A"
            best_month_rev = float(best_month_row[1]) if best_month_row else 0
            best_month_reason = "No data available."

            if best_month != "N/A":
                top_dish_best = cursor.execute(f"""
                    SELECT TOP 1 M.name
                    FROM ORDER_ITEM OI JOIN MENU_ITEM M ON OI.MENU_ITEM_ID=M.MENU_ITEM_ID JOIN [ORDER] O ON OI.ORDER_ID=O.ORDER_ID
                    WHERE O.status NOT IN ('New','Cancelled') AND FORMAT(O.ordered_at,'yyyy-MM') = '{best_month}'
                    GROUP BY M.name ORDER BY SUM(OI.quantity) DESC
                """).fetchone()
                
                best_dish = top_dish_best[0] if top_dish_best else "various items"
                best_month_reason = f"High sales volume, driven largely by '{best_dish}'."

            prev_year = str(int(target_year) - 1)
            prev2_year = str(int(target_year) - 2)
            
            yearly_data_raw = cursor.execute(f"""
                SELECT YEAR(ordered_at), MONTH(ordered_at), SUM(total)
                FROM [ORDER] WHERE {status_filter} AND YEAR(ordered_at) IN ({target_year}, {prev_year}, {prev2_year})
                GROUP BY YEAR(ordered_at), MONTH(ordered_at)
            """).fetchall()
            
            yearly_comp = { "current": [0]*12, "previous": [0]*12, "previous2": [0]*12 }
            for r in yearly_data_raw:
                y = str(r[0])
                m_idx = int(r[1]) - 1
                val = float(r[2])
                if y == target_year: yearly_comp["current"][m_idx] = val
                elif y == prev_year: yearly_comp["previous"][m_idx] = val
                elif y == prev2_year: yearly_comp["previous2"][m_idx] = val

            start_y = int(target_year) - 5
            end_y = int(target_year)
            
            all_years_data = cursor.execute(f"""
                SELECT YEAR(ordered_at), ISNULL(SUM(total),0)
                FROM [ORDER] 
                WHERE {status_filter} AND YEAR(ordered_at) BETWEEN {start_y} AND {end_y}
                GROUP BY YEAR(ordered_at)
            """).fetchall()
            
            db_years_map = {int(r[0]): float(r[1]) for r in all_years_data}
            all_years_comp = [{"year": str(y), "revenue": db_years_map.get(y, 0)} for y in range(start_y, end_y + 1)]

        return jsonify({
            "success": True,
            "kpis": {
                "revenue": month_revenue, "revenue_growth": round(rev_growth, 1),
                "orders": month_orders, "orders_growth": round(ord_growth, 1),
                "aov": round(aov, 2), "discounts": month_discounts
            },
            "finances": finances,
            "rev_by_type": rev_by_type,
            "top_type": top_type,
            "order_size": order_size,
            "popular_dishes": popular_dishes,
            "bottom_dishes": bottom_dishes,
            "best_month": {"month": best_month, "revenue": best_month_rev, "reason": best_month_reason},
            "yearly_comparison": yearly_comp,
            "all_years_comp": all_years_comp,
            "target_year": target_year,
            "prev_year": prev_year,
            "prev2_year": prev2_year
        })

    except Exception as e:
        import traceback
        traceback.print_exc() 
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/manager/download-report', methods=['GET'])
def download_report():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        status_filter = "WHERE status NOT IN ('New','Cancelled')"

        month_filter = f"{status_filter} AND MONTH(ordered_at)=MONTH(GETDATE()) AND YEAR(ordered_at)=YEAR(GETDATE())"
        year_filter  = f"{status_filter} AND YEAR(ordered_at)=YEAR(GETDATE())"

        month_orders, month_revenue = cursor.execute(f"SELECT COUNT(*), ISNULL(SUM(total),0) FROM [ORDER] {month_filter}").fetchone()
        year_orders, year_revenue   = cursor.execute(f"SELECT COUNT(*), ISNULL(SUM(total),0) FROM [ORDER] {year_filter}").fetchone()

        popular_items = cursor.execute("""
            SELECT TOP 5 M.name, SUM(OI.quantity)
            FROM ORDER_ITEM OI
            JOIN [ORDER] O ON O.ORDER_ID = OI.ORDER_ID
            JOIN MENU_ITEM M ON M.MENU_ITEM_ID = OI.MENU_ITEM_ID
            WHERE MONTH(O.ordered_at)=MONTH(GETDATE()) AND YEAR(O.ordered_at)=YEAR(GETDATE())
              AND O.status NOT IN ('New','Cancelled')
            GROUP BY M.name
            ORDER BY SUM(OI.quantity) DESC
        """).fetchall()
        conn.close()

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        elements = []
        styles = getSampleStyleSheet()

        try: elements.append(Image("D:/مشروع التخرج/manager1/manager/logo.jpg", width=120, height=60)); elements.append(Spacer(1,15))
        except: pass

        elements.append(Paragraph("<b>AKLTECH Restaurant - Report</b>", styles['Title']))
        elements.append(Spacer(1,15))
        elements.append(Paragraph(f"Report Generated On: {dt.datetime.now():%d %B %Y}", styles['Normal']))
        elements.append(Spacer(1,25))

        kpi_data = [
            ["Metric", "Value"],
            ["Total Orders (This Month)", month_orders],
            ["Total Revenue (This Month)", f"${month_revenue:.2f}"],
            ["Total Orders (This Year)", year_orders],
            ["Total Revenue (This Year)", f"${year_revenue:.2f}"]
        ]
        table = Table(kpi_data, colWidths=[280,150])
        table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.lightgrey), ('GRID',(0,0),(-1,-1),1,colors.black), ('ALIGN',(1,1),(-1,-1),'CENTER')]))
        elements.append(table); elements.append(Spacer(1,30))

        elements.append(Paragraph("Most Popular Dishes This Month (Top 5)", styles['Heading2']))
        elements.append(Spacer(1,10))
        popular_table = Table([["Dish","Quantity Sold"]]+list(popular_items), colWidths=[300,120])
        popular_table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.lightgrey), ('GRID',(0,0),(-1,-1),1,colors.black), ('ALIGN',(1,1),(-1,-1),'CENTER')]))
        elements.append(popular_table)

        doc.build(elements)
        buffer.seek(0)
        filename = f"AKLTECH_Report_{dt.datetime.now():%Y-%m}.pdf"
        return send_file(buffer, as_attachment=False, mimetype='application/pdf')

    except Exception as e:
        print("PDF ERROR:", e)
        return jsonify({"success": False, "message": str(e)}), 500

# ==========================
# GET TABLES
# ==========================
@app.route('/manager/tables', methods=['GET'])
def get_tables():
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT TABLE_ID, name_or_number, seats, location, status
            FROM [TABLE]
        """)

        tables = [{
            "table_id": row[0],
            "name": row[1],
            "seats": row[2],
            "location": row[3],
            "status": row[4]
        } for row in cursor.fetchall()]

        conn.close()
        return jsonify(tables)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ==========================
# RESERVATIONS
# ==========================
@app.route('/manager/reservations', methods=['GET'])
def get_reservations():
    try:
        range_filter = request.args.get("range", "today")
        date_filter = request.args.get("date", "")
        history_filter = request.args.get("history", "upcoming")

        allowed_ranges = ["today", "next_week", "next_month"]
        if range_filter not in allowed_ranges:
            return jsonify({"success": False, "message": "Invalid range filter"}), 400

        allowed_history = ["upcoming", "past"]
        if history_filter not in allowed_history:
            return jsonify({"success": False, "message": "Invalid history filter"}), 400

        if date_filter:
            try:
                datetime.datetime.strptime(date_filter, "%Y-%m-%d")
            except ValueError:
                return jsonify({"success": False, "message": "Invalid date format, must be YYYY-MM-DD"}), 400

        with get_connection() as conn:
            cursor = conn.cursor()

            if history_filter == "past":
                time_condition = "R.reserve_time < GETDATE()"
            else:
                time_condition = "R.reserve_time >= CAST(GETDATE() AS DATE)"

            date_condition = ""
            if date_filter:
                date_condition = f"AND CAST(R.reserve_time AS DATE) = '{date_filter}'"
            elif range_filter == "today":
                date_condition = "AND CAST(R.reserve_time AS DATE) = CAST(GETDATE() AS DATE)"
            elif range_filter == "next_week":
                date_condition = "AND R.reserve_time BETWEEN GETDATE() AND DATEADD(DAY, 7, GETDATE())"
            elif range_filter == "next_month":
                date_condition = "AND R.reserve_time BETWEEN GETDATE() AND DATEADD(DAY, 30, GETDATE())"

            rows = cursor.execute(f"""
                SELECT R.RESERVATION_ID, R.CUSTOMER_ID, C.name AS customer_name, C.email AS customer_email, C.phone AS customer_phone,
                       T.TABLE_ID, T.name_or_number, T.seats, T.location,
                       T.status AS table_status, R.reserve_time, 
                       R.party_size, R.status AS reservation_status,
                       R.special_requests, R.created_at
                FROM RESERVATION R
                JOIN [TABLE] T ON R.TABLE_ID=T.TABLE_ID
                LEFT JOIN CUSTOMER C ON R.CUSTOMER_ID = C.CUSTOMER_ID
                WHERE {time_condition} {date_condition}
                ORDER BY R.reserve_time ASC
            """).fetchall()

            reservations = [{
                "reservation_id": r.RESERVATION_ID,
                "customer_id": r.CUSTOMER_ID,
                "customer_name": r.customer_name,
                "customer_email": r.customer_email,
                "customer_phone": r.customer_phone,
                "table_id": r.TABLE_ID,
                "table_name": r.name_or_number,
                "seats": r.seats,
                "location": r.location,
                "table_status": r.table_status,
                "time": str(r.reserve_time),
                "guests": r.party_size,
                "reservation_status": r.reservation_status,
                "requests": r.special_requests,
                "created_at": str(r.created_at) if hasattr(r, 'created_at') and r.created_at else str(r.reserve_time)
            } for r in rows]

        return jsonify(reservations)

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/manager/cancel-reservation', methods=['POST'])
def cancel_reservation():
    try:
        data = request.json
        reservation_id = data.get("reservation_id")

        if reservation_id is None:
            return jsonify({"success": False, "message": "Missing reservation_id"}), 400

        if not isinstance(reservation_id, int):
            return jsonify({"success": False, "message": "reservation_id must be an integer"}), 400

        with get_connection() as conn:
            cursor = conn.cursor()
            row = cursor.execute("SELECT TABLE_ID FROM RESERVATION WHERE RESERVATION_ID=?", (reservation_id,)).fetchone()
            if not row:
                return jsonify({"success": False, "message": "Reservation not found"}), 404

            table_id = row[0]
            cursor.execute("UPDATE RESERVATION SET status='Cancelled' WHERE RESERVATION_ID=?", (reservation_id,))
            cursor.execute("UPDATE [TABLE] SET status='Available' WHERE TABLE_ID=?", (table_id,))
            conn.commit()

        return jsonify({"success": True, "message": "Reservation cancelled successfully"})

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# ==========================
# AI Recommendations
# ==========================
@app.route('/manager/ai-forecasts', methods=['GET'])
def ai_forecasts_route():
    result = get_ai_forecasts()
    if not result.get("success"):
        return jsonify(result), 400
        
    return jsonify(result)

# ==========================
# CASHIERS & PASSWORD MGT
# ==========================
@app.route('/manager/cashiers', methods=['GET'])
def get_cashiers():
    try:
        with get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                SELECT STAFF_ID, name
                FROM STAFF
                WHERE LOWER(role) = 'cashier' AND is_active = 1
            """)

            rows = cursor.fetchall()

            result = [{
                "id": r[0],
                "name": r[1]
            } for r in rows]

        return jsonify(result)

    except Exception as e:
        print("CASHIERS ERROR:", e)
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/manager/reset-password/<int:staff_id>', methods=['POST'])
def reset_password(staff_id):
    try:
        data = request.get_json()
        print("DATA RECEIVED:", data)

        new_password = data.get("password")

        if not new_password:
            return jsonify({"success": False, "message": "Password is required"}), 400

        if len(new_password) < 8:
            return jsonify({"success": False, "message": "Password must be at least 8 characters"}), 400

        password_regex = r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$'
        if not re.match(password_regex, new_password):
            return jsonify({
                "success": False,
                "message": "Weak password"
            }), 400

        hashed_password = generate_password_hash(new_password)

        with get_connection() as conn:
            cursor = conn.cursor()

            user = cursor.execute(
                "SELECT STAFF_ID FROM Staff_Users WHERE STAFF_ID=?",
                (staff_id,)
            ).fetchone()

            if not user:
                return jsonify({"success": False, "message": "User not found"}), 404

            cursor.execute("""
                UPDATE Staff_Users
                SET password = ?
                WHERE STAFF_ID = ?
            """, (hashed_password, staff_id))

            conn.commit()

        return jsonify({
            "success": True,
            "message": "Password reset successfully"
        })

    except Exception as e:
        print("RESET ERROR:", e)
        return jsonify({"success": False, "message": str(e)}), 500

# ==========================
# MENU MANAGEMENT (NEW)
# ==========================
@app.route('/manager/menu', methods=['GET'])
def get_menu():
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT MENU_ITEM_ID, MENU_CATEGORY_ID, name, description, price, image_url, is_available 
                FROM [dbo].[MENU_ITEM]
            """)
            columns = [column[0] for column in cursor.description]
            items = [dict(zip(columns, row)) for row in cursor.fetchall()]
            
        return jsonify(items), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/manager/menu', methods=['POST'])
def add_menu_item():
    data = request.json
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO [dbo].[MENU_ITEM] (MENU_CATEGORY_ID, name, description, price, image_url, is_available, created_at)
                VALUES (?, ?, ?, ?, ?, ?, GETDATE())
            """, (
                data.get('MENU_CATEGORY_ID'), data.get('name'), data.get('description'), 
                data.get('price'), data.get('image_url'), data.get('is_available')
            ))
            conn.commit()
        return jsonify({"message": "Item added successfully", "success": True}), 201
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500

@app.route('/manager/menu/<int:item_id>', methods=['PUT'])
def update_menu_item(item_id):
    data = request.json
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE [dbo].[MENU_ITEM]
                SET MENU_CATEGORY_ID=?, name=?, description=?, price=?, image_url=?, is_available=?, updated_at=GETDATE()
                WHERE MENU_ITEM_ID=?
            """, (
                data.get('MENU_CATEGORY_ID'), data.get('name'), data.get('description'), 
                data.get('price'), data.get('image_url'), data.get('is_available'), item_id
            ))
            conn.commit()
        return jsonify({"message": "Item updated successfully", "success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500

@app.route('/manager/menu/<int:item_id>', methods=['DELETE'])
def delete_menu_item(item_id):
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM [dbo].[MENU_ITEM] WHERE MENU_ITEM_ID=?", (item_id,))
            conn.commit()
        return jsonify({"message": "Item deleted successfully", "success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500

# ==========================
# FEEDBACK
# ==========================
@app.route('/manager/feedback', methods=['GET'])
def get_feedback():
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            feedback = [{
                "feedback_id": r.FEEDBACK_ID,
                "order_id": r.ORDER_ID,
                "customer_id": r.CUSTOMER_ID,
                "customer_name": r.customer_name, 
                "rating": r.rating,
                "comment": r.comment,
                "tags": r.tags,
                "date": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "N/A"
            } for r in cursor.execute("""
                SELECT F.FEEDBACK_ID, F.ORDER_ID, F.CUSTOMER_ID, C.name AS customer_name,
                    F.rating, F.comment, F.tags, F.created_at
                FROM FEEDBACKS F
                LEFT JOIN CUSTOMER C ON F.CUSTOMER_ID = C.CUSTOMER_ID
                ORDER BY F.created_at DESC
            """).fetchall()]
        return jsonify(feedback)
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# -------------------------
# RUN APP
# -------------------------
if __name__ == '__main__':
    app.run(debug=True)