import time 
from datetime import timedelta, datetime
from werkzeug.security import check_password_hash
import pyodbc
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify, make_response
import mimetypes

mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/css', '.css')
app = Flask(__name__)
app.secret_key = 'akltach_secret_key'
failed_attempts = {}

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    PERMANENT_SESSION_LIFETIME=1800 
)

@app.after_request
def add_security_headers(response):
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response

def get_db_connection():
    try:
        conn = pyodbc.connect(
            'DRIVER={ODBC Driver 17 for SQL Server};'
            'SERVER=db33942.public.databaseasp.net;'
            'DATABASE=db33942;'
            'UID=db33942;'
            'PWD=project2026;'
        )
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return None

# --- Routes ---
@app.route('/')
def login_page():
    return render_template('login.html')

def update_failed_attempts(username, current_time):
    if username not in failed_attempts:
        failed_attempts[username] = {'count': 1, 'block_until': None}
    else:
        failed_attempts[username]['count'] += 1
    
    count = failed_attempts[username]['count']
    if count >= 5:
        failed_attempts[username]['block_until'] = current_time + timedelta(minutes=15)
        flash("تجاوزت المحاولات. تم حظر الحساب لمدة 15 دقيقة.", "error")
    else:
        flash(f"كلمة مرور خاطئة. محاولة {count} من 5.", "error")

@app.route('/login', methods=['POST'])
def login_action():
    username = request.form.get('username', '').strip()
    password = request.form.get('password', '').strip()
    current_time = datetime.now()

    if username in failed_attempts:
        user_data = failed_attempts[username]
        if user_data['count'] >= 5 and user_data['block_until']:
            if current_time < user_data['block_until']:
                time_left = int((user_data['block_until'] - current_time).total_seconds() / 60)
                flash(f"حسابك محظور مؤقتاً. حاول ثانية بعد {max(1, time_left)} دقيقة.", "error")
                return redirect(url_for('login_page'))
            else:
                failed_attempts[username] = {'count': 0, 'block_until': None}

    conn = get_db_connection()
    if conn:
        cursor = conn.cursor()
        query = "SELECT u.username, u.password, s.role, s.name, s.STAFF_ID FROM Staff_Users u JOIN Staff s ON u.STAFF_ID = s.STAFF_ID WHERE u.username = ?"
        cursor.execute(query, (username,))
        row = cursor.fetchone()
        
        if row:
            db_username, db_password_hash, db_role, real_name, staff_id = row
            
            if check_password_hash(db_password_hash, password):
                failed_attempts[username] = {'count': 0, 'block_until': None}
                
                if db_role == 'Cashier':
                    session.clear()
                    session['user'] = db_username
                    session['real_name'] = real_name
                    session['staff_id'] = staff_id 
                    flash(f"Welcome back, {real_name}! 👋", "success")
                    conn.close()
                    return redirect(url_for('dashboard_route'))
                else:
                    flash("عفواً، الدخول مسموح فقط للكاشير.", "error")
            else:
                update_failed_attempts(username, current_time)
        else:
            time.sleep(1)
            flash("خطأ في اسم المستخدم أو كلمة المرور.", "error")
        
        conn.close()
    return redirect(url_for('login_page'))

@app.route('/dashboard')
def dashboard_route():
    if 'user' in session:
        today = datetime.now().strftime('%d/%m/%Y') 
        return render_template('dashboard.html', username=session['user'], real_name=session.get('real_name'), current_date=today)
    return redirect(url_for('login_page'))

@app.route('/table-status')
def tables_map_page():
    if 'user' in session:
        today = datetime.now().strftime('%d/%m/%Y')
        return render_template('tables.html', username=session['user'], real_name=session.get('real_name'), current_date=today)
    return redirect(url_for('login_page'))

@app.route('/history')
def history():
    if 'user' in session:
        today = datetime.now().strftime('%d/%m/%Y')
        return render_template('history.html', username=session['user'], real_name=session.get('real_name'), current_date=today)
    return redirect(url_for('login_page'))

# --- APIs ---
@app.route('/api/get_menu')
def get_menu():
    conn = get_db_connection()
    if not conn: return jsonify({"menu": []}), 500
    try:
        cursor = conn.cursor()
        query = """
            SELECT m.MENU_ITEM_ID, m.name, m.price, COALESCE(c.name, 'Other') as category_name 
            FROM MENU_ITEM m 
            LEFT JOIN MENU_CATEGORY c ON m.MENU_CATEGORY_ID = c.MENU_CATEGORY_ID 
            WHERE m.is_available = 1
            ORDER BY category_name, m.name
        """
        cursor.execute(query)
        menu = [{"id": r[0], "name": r[1], "price": float(r[2]) if r[2] else 0, "category": r[3]} for r in cursor.fetchall()]
        conn.close()
        return jsonify({"menu": menu})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/get_active_orders')
def get_active_orders():
    conn = get_db_connection()
    if not conn: return jsonify({"orders": []}), 500
    try:
        cursor = conn.cursor()
        
        query = """
            SELECT o.ORDER_ID, RTRIM(LTRIM(o.status)), o.total, o.TABLE_ID, c.name, RTRIM(LTRIM(o.order_type)),
                   (SELECT TOP 1 method FROM PAYMENT WHERE ORDER_ID = o.ORDER_ID) as method,
                   res.reserve_time,
                   res.party_size,
                   o.Notes, o.tax, o.delivery_fee, o.discount_amount, c.address, c.phone, st.name,
                   o.expected_time
            FROM [ORDER] o 
            LEFT JOIN CUSTOMER c ON o.CUSTOMER_ID = c.CUSTOMER_ID
            LEFT JOIN STAFF st ON o.STAFF_ID = st.STAFF_ID
            LEFT JOIN RESERVATION res ON o.RESERVATION_ID = res.RESERVATION_ID
            WHERE RTRIM(LTRIM(o.status)) IN ('New', 'Confirmed', 'Preparing', 'Ready', 'Payment')
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        orders_list = []
        for r in rows:
            cursor.execute("""
                SELECT oi.ORDER_ITEM_ID, m.name, oi.quantity, oi.unit_price, oi.notes 
                FROM ORDER_ITEM oi 
                JOIN MENU_ITEM m ON oi.MENU_ITEM_ID = m.MENU_ITEM_ID 
                WHERE oi.ORDER_ID = ?
            """, (r[0],))
            
            items = [{"item_id": x[0], "name": x[1], "quantity": x[2], "price": float(x[3]) if x[3] else 0, "item_notes": x[4] if x[4] else ""} for x in cursor.fetchall()]
            
            table_id = r[3]
            raw_order_type = r[5]
            
            if raw_order_type and str(raw_order_type).strip() != "" and str(raw_order_type).strip() != "NULL" and str(raw_order_type).strip() != "None":
                final_type = str(raw_order_type).strip()
            else:
                if table_id and str(table_id) != "NULL" and str(table_id) != "None":
                    final_type = "Dine-in"
                else:        
                    final_type = "Takeaway"

            orders_list.append({
                "id": str(r[0]), "status": r[1].lower(), "total": float(r[2]) if r[2] else 0, 
                "table_id": str(table_id) if table_id else None, 
                "customer": r[4] if r[4] else "Guest", 
                "order_type": final_type,
                "payment_method": r[6] if r[6] else "Not Specified",
                "reserve_time": r[7].strftime('%Y-%m-%d %H:%M') if r[7] else None,
                "party_size": r[8] if r[8] else None,
                "notes": r[9] if r[9] else "",
                "tax": float(r[10]) if r[10] else 0,
                "delivery_fee": float(r[11]) if r[11] else 0,
                "discount_amount": float(r[12]) if r[12] else 0,
                "address": r[13] if r[13] else "",
                "phone": r[14] if r[14] else "",
                "cashier": r[15] if r[15] else "System", 
                "prepTime": r[16].strftime('%I:%M %p') if r[16] else None, 
                "items": items
            })
        conn.close()
        return jsonify({"orders": orders_list})
    except Exception as e:
        print("Error details:", str(e))
        return jsonify({"error": str(e)}), 500

@app.route('/api/update_order_status', methods=['POST'])
def update_order_status():
    data = request.json
    order_id = data.get('id')
    new_status = data.get('status')
    prep_time = data.get('prepTime')
    
    # استلام الخصم والإجمالي النهائي
    discount = data.get('discount')
    final_total = data.get('finalTotal')
    
    staff_id = session.get('staff_id') 
    
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            
            if new_status.lower() == 'cancelled': new_status = 'Cancelled'
            elif new_status.lower() == 'confirmed': new_status = 'Confirmed'
            elif new_status.lower() == 'preparing': new_status = 'Preparing'
                
            # حفظ الخصم في الداتا بيز وقت الدفع
            if discount is not None and final_total is not None:
                cursor.execute("UPDATE [ORDER] SET discount_amount = ?, total = ? WHERE ORDER_ID = ?", (discount, final_total, order_id))

            if prep_time:
                prep_mins = int(prep_time)
                expected_time_val = datetime.now() + timedelta(minutes=prep_mins)
                query = "UPDATE [ORDER] SET status = ?, expected_time = ?, STAFF_ID = ? WHERE ORDER_ID = ?"
                cursor.execute(query, (new_status, expected_time_val, staff_id, order_id))
            else:
                query = "UPDATE [ORDER] SET status = ?, STAFF_ID = ? WHERE ORDER_ID = ?"
                cursor.execute(query, (new_status, staff_id, order_id))
                
            conn.commit()
            conn.close()
            return jsonify({"success": True})
        except Exception as e:
            if conn: conn.close()
            return jsonify({"success": False, "error": str(e)}), 500
    return jsonify({"success": False}), 500

@app.route('/api/edit_order', methods=['POST'])
def edit_order():
    data = request.json
    order_id = data.get('order_id')
    items = data.get('items')
    new_total = data.get('total')
    
    # استلام الدليفري
    delivery_fee = data.get('delivery_fee', 0)
    
    staff_id = session.get('staff_id') 
    
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            
            # حفظ الدليفري في الداتا بيز
            cursor.execute("UPDATE [ORDER] SET total = ?, delivery_fee = ?, STAFF_ID = ? WHERE ORDER_ID = ?", (new_total, delivery_fee, staff_id, order_id))
            
            kept_item_ids = [item['item_id'] for item in items if item.get('item_id') and item['item_id'] != 'new']
            
            if kept_item_ids:
                placeholders = ','.join(['?'] * len(kept_item_ids))
                delete_query = f"DELETE FROM ORDER_ITEM WHERE ORDER_ID = ? AND ORDER_ITEM_ID NOT IN ({placeholders})"
                params = [order_id] + kept_item_ids
                cursor.execute(delete_query, params)
            else:
                cursor.execute("DELETE FROM ORDER_ITEM WHERE ORDER_ID = ?", (order_id,))
                
            cursor.execute("SELECT ISNULL(MAX(ORDER_ITEM_ID), 0) FROM ORDER_ITEM")
            current_max_id = cursor.fetchone()[0]
            
            for item in items:
                if item.get('item_id') and item['item_id'] != 'new':
                    cursor.execute("UPDATE ORDER_ITEM SET quantity = ?, unit_price = ? WHERE ORDER_ITEM_ID = ?", (item['quantity'], item['price'], item['item_id']))
                elif item.get('item_id') == 'new' and item.get('menu_id'):
                    current_max_id += 1
                    cursor.execute("INSERT INTO ORDER_ITEM (ORDER_ITEM_ID, ORDER_ID, MENU_ITEM_ID, quantity, unit_price) VALUES (?, ?, ?, ?, ?)", (current_max_id, order_id, item['menu_id'], item['quantity'], item['price']))
                    
            conn.commit()
            conn.close()
            return jsonify({"success": True})
        except Exception as e:
            if conn: conn.close()
            print(f"Edit Database Error: {str(e)}") 
            return jsonify({"success": False, "error": str(e)}), 500
    return jsonify({"success": False}), 500

@app.route('/api/dashboard-stats')
def get_dashboard_stats():
    conn = get_db_connection()
    if not conn: return jsonify({"error": "DB failed"}), 500
    try:
        cursor = conn.cursor()
        # Query نظيفة بتجيب كل الحالات النشطة + الـ Completed بتاعة النهاردة بس
        query = """
            SELECT 
                LOWER(RTRIM(LTRIM(status))) as status_name, 
                COUNT(*) 
            FROM [ORDER] 
            WHERE 
                (LOWER(RTRIM(LTRIM(status))) IN ('new', 'confirmed', 'preparing', 'ready', 'payment'))
                OR 
                (LOWER(RTRIM(LTRIM(status))) = 'completed' 
                 AND CAST(DATEADD(HOUR, -3, ordered_at) AS DATE) = CAST(DATEADD(HOUR, -3, GETDATE()) AS DATE))
            GROUP BY status
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        # تحويل النتائج لـ Dictionary
        stats = {row[0]: row[1] for row in rows}
        
        # تأكيد وجود الحالات الأساسية عشان الـ UI ميبقاش فيه أخطاء
        for s in ['completed', 'payment', 'ready', 'preparing', 'new']:
            if s not in stats:
                stats[s] = 0
                
        conn.close()
        return jsonify(stats)
    except Exception as e:
        if conn: conn.close()
        print("Dashboard Stats Error:", str(e))
        return jsonify({"error": str(e)}), 500
        
@app.route('/api/get_tables')
def get_tables():
    conn = get_db_connection()
    if not conn: return jsonify({"error": "Database failed"}), 500
    try:
        cursor = conn.cursor()
        query = "SELECT TABLE_ID, name_or_number, seats, status FROM [TABLE]"
        cursor.execute(query)
        rows = cursor.fetchall()
        tables_list = [{"id": row[0], "name": row[1], "seats": row[2], "status": row[3]} for row in rows]
        conn.close()
        response = make_response(jsonify({"tables": tables_list}))
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        return response
    except Exception as e:
        if conn: conn.close()
        return jsonify({"error": str(e)}), 500

@app.route('/api/update_table_status', methods=['POST'])
def update_table_status():
    data = request.json
    table_id, new_status = data.get('table_id'), data.get('status')
    conn = get_db_connection()
    if conn:
        cursor = conn.cursor()
        query = "UPDATE [TABLE] SET status = ? WHERE TABLE_ID = ?"
        cursor.execute(query, (new_status, table_id))
        conn.commit()
        conn.close()
        return jsonify({"success": True})
    return jsonify({"success": False}), 500

@app.route('/api/get_order_history')
def get_order_history():
    conn = get_db_connection()
    if not conn: return jsonify({"error": "Connection failed"}), 500
    try:
        cursor = conn.cursor()
        query = """
            SELECT 
                o.ORDER_ID, 
                o.total, 
                o.ordered_at, 
                COALESCE(c.name, 'Table #' + CAST(o.TABLE_ID AS VARCHAR), 'Takeaway') as display_name, 
                ISNULL(RTRIM(LTRIM(o.order_type)), 'Takeaway') AS order_type,
                m.name as item_name, 
                oi.quantity as item_quantity
            FROM [ORDER] o 
            LEFT JOIN CUSTOMER c ON o.CUSTOMER_ID = c.CUSTOMER_ID
            LEFT JOIN ORDER_ITEM oi ON o.ORDER_ID = oi.ORDER_ID
            LEFT JOIN MENU_ITEM m ON oi.MENU_ITEM_ID = m.MENU_ITEM_ID
            WHERE LOWER(RTRIM(LTRIM(o.status))) = 'completed'
            AND CAST(DATEADD(HOUR, -3, o.ordered_at) AS DATE) = CAST(DATEADD(HOUR, -3, GETDATE()) AS DATE)
           
            ORDER BY o.ordered_at DESC
        """
        cursor.execute(query)
        rows = cursor.fetchall()
        
        orders_dict = {}
        for r in rows:
            order_id = r[0]
            if order_id not in orders_dict:
                orders_dict[order_id] = {
                    "id": order_id, 
                    "total": str(r[1]), 
                    "time": r[2].strftime('%d/%m/%Y %I:%M %p') if r[2] else "", 
                    "customer": r[3], 
                    "type": r[4],
                    "items": []
                }
            if r[5]:
                orders_dict[order_id]["items"].append({
                    "name": r[5], 
                    "quantity": r[6]
                })
        history_list = list(orders_dict.values())
        conn.close()
        return jsonify({"history": history_list})
    except Exception as e:
        if conn: conn.close()
        print("Fast History Error:", str(e))
        return jsonify({"error": str(e)}), 500

@app.route('/api/get_order_items/<int:order_id>')
def get_order_items(order_id):
    conn = get_db_connection()
    if not conn: return jsonify({"items": []}), 500
    try:
        cursor = conn.cursor()
        query = """
            SELECT m.name, oi.quantity 
            FROM ORDER_ITEM oi 
            JOIN MENU_ITEM m ON oi.MENU_ITEM_ID = m.MENU_ITEM_ID 
            WHERE oi.ORDER_ID = ?
        """
        cursor.execute(query, (order_id,))
        items = [{"name": r[0], "quantity": r[1]} for r in cursor.fetchall()]
        conn.close()
        return jsonify({"items": items})
    except Exception as e:
        if conn: conn.close()
        return jsonify({"error": str(e)}), 500

# دوال الحجوزات للكاشير 
@app.route('/api/reservations', methods=['GET'])
def get_cashier_reservations():
    try:
        range_filter = request.args.get("range", "today")
        start_date = request.args.get("start_date", "")
        end_date = request.args.get("end_date", "")
        history_filter = request.args.get("history", "upcoming")

        conn = get_db_connection()
        if not conn: return jsonify([]), 500
        cursor = conn.cursor()

        if history_filter == "past":
            time_condition = "R.reserve_time < GETDATE()"
        else:
            time_condition = "R.reserve_time >= CAST(GETDATE() AS DATE)" 

        date_condition = ""
        # إضافة فلتر من تاريخ لتاريخ
        if start_date and end_date:
            date_condition = f"AND CAST(R.reserve_time AS DATE) BETWEEN '{start_date}' AND '{end_date}'"
        elif start_date:
            date_condition = f"AND CAST(R.reserve_time AS DATE) >= '{start_date}'"
        elif end_date:
            date_condition = f"AND CAST(R.reserve_time AS DATE) <= '{end_date}'"
        # باقي الفلاتر القديمة
        elif range_filter == "today":
            date_condition = "AND CAST(R.reserve_time AS DATE) = CAST(GETDATE() AS DATE)"
        elif range_filter == "next_week":
            date_condition = "AND R.reserve_time BETWEEN GETDATE() AND DATEADD(DAY, 7, GETDATE())"
        elif range_filter == "next_month":
            date_condition = "AND R.reserve_time BETWEEN GETDATE() AND DATEADD(DAY, 30, GETDATE())"

        query = f"""
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
        """
        cursor.execute(query)
        rows = cursor.fetchall()

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
        
        conn.close()
        return jsonify(reservations)

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/cancel-reservation', methods=['POST'])
def cancel_cashier_reservation():
    data = request.json
    res_id = data.get('reservation_id')
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            cursor.execute("UPDATE RESERVATION SET status = 'Cancelled' WHERE RESERVATION_ID = ?", (res_id,))
            conn.commit()
            conn.close()
            return jsonify({"success": True})
        except Exception as e:
            if conn: conn.close()
            return jsonify({"success": False, "message": str(e)}), 500
    return jsonify({"success": False, "message": "DB Error"}), 500

@app.route('/logout')
def logout():
    session.clear() 
    return redirect(url_for('login_page'))

# --- نظام النسخ الاحتياطي التلقائي ---
import threading
import csv
import os

def run_daily_backup():
    while True:
        now = datetime.now()
        if now.hour == 2 and now.minute == 58:
            backup_dir = 'System_Backups'
            if not os.path.exists(backup_dir):
                os.makedirs(backup_dir)
            
            try:
                conn = get_db_connection()
                if conn:
                    cursor = conn.cursor()
                    query = """
                        SELECT o.ORDER_ID, COALESCE(c.name, 'Guest'), ISNULL(RTRIM(LTRIM(o.order_type)), 'Takeaway'), 
                               o.ordered_at, o.total, RTRIM(LTRIM(o.status))
                        FROM [ORDER] o 
                        LEFT JOIN CUSTOMER c ON o.CUSTOMER_ID = c.CUSTOMER_ID
                        WHERE LOWER(RTRIM(LTRIM(o.status))) = 'completed'
                          AND CAST(o.ordered_at AS DATE) = CAST(GETDATE() AS DATE)
                    """
                    cursor.execute(query)
                    rows = cursor.fetchall()
                    
                    filename = f"AKLTECH_Backup_{now.strftime('%Y-%m-%d')}.csv"
                    filepath = os.path.join(backup_dir, filename)
                    
                    with open(filepath, 'w', newline='', encoding='utf-8') as f:
                        writer = csv.writer(f)
                        writer.writerow(['Order ID', 'Customer Name', 'Order Type', 'Time', 'Amount', 'Status'])
                        for r in rows:
                            time_str = r[3].strftime('%I:%M %p') if r[3] else ''
                            writer.writerow([r[0], r[1], r[2], time_str, f"{float(r[4])} EGP", r[5]])
                    
                    conn.close()
            except Exception as e:
                print("Backup Error:", e)
            
            time.sleep(60) 
        time.sleep(30) 

threading.Thread(target=run_daily_backup, daemon=True).start()

if __name__ == '__main__':
    app.run(debug=True, port=5000)