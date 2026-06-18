import os
import platform
from flask import Flask, request, jsonify
from flask_cors import CORS
import pyodbc
from werkzeug.security import generate_password_hash, check_password_hash
import uuid
import jwt
from datetime import datetime, timedelta
from functools import wraps
import json
from dotenv import load_dotenv

# تحميل متغيرات البيئة من ملف .env
load_dotenv()

app = Flask(__name__)
# مفتاح التشفير الخاص بـ Flask و JWT
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'default-dev-secret-key-change-it')

CORS(app) 

# إعدادات الاتصال بقاعدة البيانات
def get_db_connection():
    db_server = os.environ.get('DB_SERVER', 'db33942.public.databaseasp.net')
    db_name = os.environ.get('DB_NAME', 'db33942')
    db_user = os.environ.get('DB_USER', 'db33942')
    db_password = os.environ.get('DB_PASSWORD', 'project2026') 

    # 🔴 التعديل هنا: تحديد الدرايفر بناءً على نظام التشغيل
    driver = '{ODBC Driver 18 for SQL Server}' if platform.system() == 'Linux' else '{SQL Server}'
    driver = os.environ.get('DB_DRIVER', driver)

    conn_str = (
        f'DRIVER={driver};'
        f'SERVER={db_server};'
        f'DATABASE={db_name};'
        f'UID={db_user};'
        f'PWD={db_password};' 
        'TrustServerCertificate=yes;' # مهم للاتصال السحابي بقواعد بيانات مايكروسوفت
    )
    conn = pyodbc.connect(conn_str)
    return conn

# ==========================================
# 🔴 دالة حماية المسارات (JWT Middleware)
# ==========================================
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            return jsonify({}), 200

        token = None
        if 'Authorization' in request.headers:
            parts = request.headers['Authorization'].split()
            if len(parts) == 2 and parts[0] == 'Bearer':
                token = parts[1]

        if not token:
            return jsonify({'error': 'Token is missing!'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user_id = data['customer_id']
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token!'}), 401

        return f(current_user_id, *args, **kwargs)
    return decorated

@app.route('/')
def home():
    return "AKLTECH API is running successfully!"

# ==========================================
# 1. مسار تسجيل حساب جديد (Sign Up)
# ==========================================
@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    phone = data.get('phone')
    password = data.get('password')

    if not all([name, email, phone, password]):
        return jsonify({'error': 'Missing required fields'}), 400

    hashed_password = generate_password_hash(password)

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT email, phone FROM CUSTOMER WHERE email = ? OR phone = ?", (email, phone))
        existing_user = cursor.fetchone()

        if existing_user:
            existing_email = existing_user[0]
            existing_phone = existing_user[1]
            
            if existing_email == email and existing_phone == phone:
                return jsonify({'error': 'Both Email and Phone are already registered.', 'field': 'both'}), 400
            elif existing_email == email:
                return jsonify({'error': 'This Email is already registered to another account.', 'field': 'email'}), 400
            elif existing_phone == phone:
                return jsonify({'error': 'This Phone number is already registered to another account.', 'field': 'phone'}), 400

        insert_query = """
        INSERT INTO CUSTOMER (name, email, phone, password_hash)
        VALUES (?, ?, ?, ?)
        """
        cursor.execute(insert_query, (name, email, phone, hashed_password))
        conn.commit()
        return jsonify({'message': 'Account created successfully!'}), 201

    except Exception as e:
        print("SIGNUP ERROR:", str(e))
        return jsonify({'error': 'An internal error occurred.'}), 500
    finally:
        if 'conn' in locals(): conn.close()

# ==========================================
# 2. مسار تسجيل الدخول (Login)
# ==========================================
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email') 
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'Missing email or password'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT CUSTOMER_ID, password_hash FROM CUSTOMER WHERE email = ?", (email,))
        user = cursor.fetchone()

        if user and check_password_hash(user[1], password):
            token_payload = {
                'customer_id': user[0],
                'exp': datetime.utcnow() + timedelta(hours=24) 
            }
            token = jwt.encode(token_payload, app.config['SECRET_KEY'], algorithm="HS256")
            
            return jsonify({
                'message': 'Login successful', 
                'token': token, 
                'customer_id': user[0] 
            }), 200
        else:
            return jsonify({'error': 'Invalid credentials'}), 401

    except Exception as e:
        print("LOGIN ERROR:", str(e))
        return jsonify({'error': 'An internal error occurred.'}), 500
    finally:
        if 'conn' in locals(): conn.close()

# ==========================================
# 3. مسار المنيو (Menu)
# ==========================================
@app.route('/api/menu', methods=['GET'])
def get_menu():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
            SELECT 
                m.MENU_ITEM_ID as id, 
                m.name as name, 
                c.name as category, 
                m.price as price, 
                m.image_url as image, 
                m.description as description,
                m.is_spicy, 
                m.is_vegan, 
                m.is_healthy,
                m.Cuisine as cuisine,
                m.calories as calories
            FROM MENU_ITEM m
            JOIN MENU_CATEGORY c ON m.MENU_CATEGORY_ID = c.MENU_CATEGORY_ID
            WHERE m.is_available = 1
        """
        cursor.execute(query)
        
        columns = [column[0] for column in cursor.description]
        items = [dict(zip(columns, row)) for row in cursor.fetchall()]

        for item in items:
            tags = []
            if item.get('is_spicy'): tags.append("spicy")
            if item.get('is_vegan'): tags.append("vegan")
            if item.get('is_healthy'): tags.append("healthy")
            item['tags'] = tags
            item['price'] = float(item['price']) if item['price'] is not None else 0.0
            item['calories'] = int(item['calories']) if item['calories'] is not None else 0

        return jsonify(items)
        
    except Exception as e:
        print("GET MENU ERROR:", str(e))
        return jsonify({"error": "Failed to fetch menu."}), 500
    finally:
        if 'conn' in locals(): conn.close()

# ==========================================
# 4. مسار التحقق من توفر الطاولة (Check Availability)
# ==========================================
@app.route('/api/check_availability', methods=['POST', 'OPTIONS'])
def check_availability():
    if request.method == 'OPTIONS': return jsonify({}), 200
    
    data = request.get_json()
    table_id = data.get('table_id')
    res_date = data.get('res_date')
    res_time = data.get('res_time')

    if not all([table_id, res_date, res_time]):
        return jsonify({'error': 'Incomplete reservation data.'}), 400

    try:
        dt_str = f"{res_date} {res_time}"
        requested_time = datetime.strptime(dt_str, "%Y-%m-%d %H:%M").strftime("%Y-%m-%d %H:%M:%S")

        conn = get_db_connection()
        cursor = conn.cursor()

        check_query = """
            SELECT RESERVATION_ID, reserve_time 
            FROM RESERVATION
            WHERE TABLE_ID = ? 
            AND status != 'Cancelled'
            AND ABS(DATEDIFF(minute, reserve_time, ?)) < 180
        """
        cursor.execute(check_query, (table_id, requested_time))
        conflict = cursor.fetchone()

        if conflict:
            return jsonify({'error': 'Sorry, this table is already booked within 3 hours of your selected time.'}), 400

        return jsonify({'message': 'Table is available.'}), 200

    except Exception as e:
        print("CHECK AVAILABILITY ERROR:", str(e))
        return jsonify({'error': 'An internal error occurred.'}), 500
    finally:
        if 'conn' in locals(): conn.close()

# ==========================================
# 5. مسار إتمام الطلب والدفع (Checkout) 
# ==========================================
@app.route('/api/checkout', methods=['POST', 'OPTIONS'])
def process_checkout():
    if request.method == 'OPTIONS': return jsonify({}), 200
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data received'}), 400
        
        raw_customer_id = data.get('customer_id') 
        cart_items = data.get('cart_items', [])
        payment_method = data.get('payment_method') 
        raw_table_id = data.get('table_id')
        delivery_address = data.get('delivery_address')
        
        notes = data.get('notes', None)
        subtotal = float(data.get('subtotal', 0))
        tax = float(data.get('tax', 0))
        total = float(data.get('total', 0))

        if not cart_items:
            return jsonify({'error': 'Cart is empty'}), 400

        customer_id = None
        if raw_customer_id and raw_customer_id != 'null':
            try: customer_id = int(raw_customer_id)
            except: pass

        table_id = None
        if raw_table_id and str(raw_table_id).lower() not in ['null', 'any', 'none']:
            try:
                if '{' in str(raw_table_id):
                    parsed = json.loads(raw_table_id)
                    table_id = int(parsed.get('n') or parsed.get('id') or parsed.get('number'))
                else:
                    table_id = int(raw_table_id)
            except: pass 

        raw_order_type = data.get('order_type')
        if raw_order_type:
            order_type = raw_order_type
        else:
            if table_id is not None:
                if data.get('res_date') and data.get('res_time'):
                    order_type = 'reservation'
                else:
                    order_type = 'dine_in'
            elif delivery_address:
                order_type = 'delivery'
            else:
                order_type = 'take_away'

        txn_reference = None
        payment_status = 'pending'
        
        if payment_method == 'card':
            txn_reference = f"TXN-{uuid.uuid4().hex[:10].upper()}"
            payment_status = 'completed'
        else:
            payment_status = 'pending_cash'

        conn = get_db_connection()
        cursor = conn.cursor()
        
        if customer_id and delivery_address:
             cursor.execute("UPDATE CUSTOMER SET address = ? WHERE CUSTOMER_ID = ?", (delivery_address, customer_id))

        reservation_id = None

        if order_type == 'reservation' and table_id is not None:
            res_date = data.get('res_date')
            res_time = data.get('res_time')
            party_size_input = data.get('party_size')

            cursor.execute("SELECT seats FROM [TABLE] WHERE TABLE_ID = ?", (table_id,))
            table_row = cursor.fetchone()
            max_seats = table_row[0] if table_row else 2
            
            final_party_size = int(party_size_input) if party_size_input else max_seats
            if final_party_size > max_seats: 
                final_party_size = max_seats 

            reserve_datetime_str = None
            if res_date and res_time:
                try:
                     dt_obj = datetime.strptime(f"{res_date} {res_time}", "%Y-%m-%d %H:%M")
                     reserve_datetime_str = dt_obj.strftime("%Y-%m-%d %H:%M:%S") 
                except ValueError: pass 

            if reserve_datetime_str:
                insert_reservation_query = """
                    INSERT INTO RESERVATION (CUSTOMER_ID, TABLE_ID, reserve_time, party_size, status, created_at)
                    OUTPUT INSERTED.RESERVATION_ID
                    VALUES (?, ?, ?, ?, 'Confirmed', GETDATE())
                """
                cursor.execute(insert_reservation_query, (customer_id, table_id, reserve_datetime_str, final_party_size))
            else:
                insert_reservation_query = """
                    INSERT INTO RESERVATION (CUSTOMER_ID, TABLE_ID, reserve_time, party_size, status, created_at)
                    OUTPUT INSERTED.RESERVATION_ID
                    VALUES (?, ?, GETDATE(), ?, 'Confirmed', GETDATE())
                """
                cursor.execute(insert_reservation_query, (customer_id, table_id, final_party_size))
            
            reservation_id = cursor.fetchone()[0]

        insert_order_query = """
            INSERT INTO [ORDER] (CUSTOMER_ID, TABLE_ID, RESERVATION_ID, status, subtotal, tax, delivery_fee, discount_amount, total, Notes, order_type, ordered_at)
            OUTPUT INSERTED.ORDER_ID
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE())
        """
        cursor.execute(insert_order_query, (customer_id, table_id, reservation_id, 'New', subtotal, tax, 0, 0, total, notes, order_type))
        order_id = cursor.fetchone()[0]

        for item in cart_items:
            insert_item_query = """
                INSERT INTO ORDER_ITEM (ORDER_ID, MENU_ITEM_ID, quantity, unit_price)
                VALUES (?, ?, ?, ?)
            """
            cursor.execute(insert_item_query, (order_id, int(item['id']), int(item['quantity']), float(item['price'])))

        insert_payment_query = """
            INSERT INTO PAYMENT (ORDER_ID, method, amount, status, txn_reference, paid_at)
            VALUES (?, ?, ?, ?, ?, GETDATE())
        """
        cursor.execute(insert_payment_query, (order_id, payment_method, total, payment_status, txn_reference))

        receipt_number = f"REC-{datetime.now().strftime('%Y%m%d')}-{order_id}"
        insert_receipt_query = """
            INSERT INTO RECEIPT (ORDER_ID, receipt_number, issued_at)
            VALUES (?, ?, GETDATE())
        """
        cursor.execute(insert_receipt_query, (order_id, receipt_number))

        conn.commit() 

        return jsonify({
            'message': 'Order processed successfully!',
            'order_id': order_id,
            'receipt_number': receipt_number,
            'transaction_ref': txn_reference
        }), 201

    except Exception as e:
        if 'conn' in locals(): conn.rollback() 
        print("CHECKOUT ERROR:", str(e)) 
        return jsonify({'error': 'Failed to process checkout.'}), 500
    finally:
        if 'conn' in locals(): conn.close()

# ==========================================
# 6. مسار الطاولات (Table Reservation)
# ==========================================
@app.route('/api/tables', methods=['GET', 'OPTIONS'])
def get_tables():
    if request.method == 'OPTIONS': return jsonify({}), 200
    try:
        date_param = request.args.get('date')
        time_param = request.args.get('time')

        target_datetime_sql = "GETDATE()"
        
        if date_param and time_param:
            try:
                dt_obj = datetime.strptime(f"{date_param} {time_param}", "%Y-%m-%d %H:%M")
                target_datetime_sql = f"'{dt_obj.strftime('%Y-%m-%d %H:%M:%S')}'"
            except ValueError:
                pass 

        conn = get_db_connection()
        cursor = conn.cursor()

        query = f"""
            SELECT 
                t.TABLE_ID, t.name_or_number, t.seats, t.location,
                (
                    SELECT TOP 1 DATEADD(minute, 180, r.reserve_time)
                    FROM RESERVATION r 
                    WHERE r.TABLE_ID = t.TABLE_ID 
                    AND r.status = 'Confirmed'
                    AND ABS(DATEDIFF(minute, r.reserve_time, {target_datetime_sql})) < 180
                    ORDER BY ABS(DATEDIFF(minute, r.reserve_time, {target_datetime_sql})) ASC
                ) as available_after
            FROM [TABLE] t
            WHERE t.status != 'Hidden'
        """
        cursor.execute(query)
        
        columns = [column[0] for column in cursor.description]
        db_tables = [dict(zip(columns, row)) for row in cursor.fetchall()]

        visual_map = {
            1: {'x': 12, 'y': 15, 'type': 'round'}, 2: {'x': 28, 'y': 15, 'type': 'round'},
            3: {'x': 44, 'y': 15, 'type': 'round'}, 4: {'x': 18, 'y': 40, 'type': 'rect'},
            5: {'x': 38, 'y': 40, 'type': 'rect'},  6: {'x': 75, 'y': 55, 'type': 'round'},
            7: {'x': 73.5, 'y': 72, 'type': 'rect'}, 8: {'x': 75, 'y': 89, 'type': 'round'}
        }

        final_tables = []
        for t in db_tables:
            t_id = t['TABLE_ID']
            vis = visual_map.get(t_id, {'x': 50, 'y': 50, 'type': 'round'}) 
            
            available_time_str = None
            if t['available_after']:
                available_time_str = t['available_after'].strftime("%I:%M %p")
            
            final_tables.append({
                'id': t_id, 'seats': t['seats'] or 2, 'type': vis['type'],
                'x': vis['x'], 'y': vis['y'], 
                'reserved': bool(t['available_after']),
                'available_after': available_time_str, 
                'zone': t['location'] or "Main Hall"
            })

        return jsonify(final_tables)
        
    except Exception as e:
        print("GET TABLES ERROR:", str(e))
        return jsonify({"error": "Failed to fetch tables."}), 500
    finally:
        if 'conn' in locals(): conn.close()

# ==========================================
# 7. مسار جلب بيانات البروفايل (Profile)
# ==========================================
@app.route('/api/profile', methods=['GET'])
@token_required
def get_profile(current_user_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT name, email, phone, profile_image, address FROM CUSTOMER WHERE CUSTOMER_ID = ?", (current_user_id,))
        user_row = cursor.fetchone()
        
        if not user_row:
            return jsonify({'error': 'User not found'}), 404
            
        user_data = {
            'NAME': user_row[0], 'EMAIL': user_row[1], 'PHONE': user_row[2],
            'IMAGE': user_row[3], 'ADDRESS': user_row[4]
        }

        cursor.execute("""
            SELECT ORDER_ID AS ORD_ID, ordered_at AS ORD_DATE, total AS TOTAL_PRICE 
            FROM [ORDER] 
            WHERE CUSTOMER_ID = ? 
            ORDER BY ordered_at DESC
        """, (current_user_id,))
        
        columns = [column[0] for column in cursor.description]
        orders_data = [dict(zip(columns, row)) for row in cursor.fetchall()]

        return jsonify({'user': user_data, 'orders': orders_data}), 200

    except Exception as e:
        print("GET PROFILE ERROR:", str(e))
        return jsonify({'error': 'Failed to load profile.'}), 500
    finally:
        if 'conn' in locals(): conn.close()

# ==========================================
# 8. مسار تعديل بيانات البروفايل (Update Profile)
# ==========================================
@app.route('/api/profile', methods=['PUT', 'OPTIONS'])
@token_required
def update_profile(current_user_id):
    if request.method == 'OPTIONS': return jsonify({}), 200
    try:
        data = request.get_json()
        name = data.get('name')
        phone = data.get('phone')
        profile_image = data.get('profile_image')
        address = data.get('address')

        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
            UPDATE CUSTOMER 
            SET name = ?, phone = ?, profile_image = ?, address = ?, updated_at = GETDATE()
            WHERE CUSTOMER_ID = ?
        """
        cursor.execute(query, (name, phone, profile_image, address, current_user_id))
        conn.commit()

        return jsonify({'message': 'Profile updated successfully!'}), 200
    except Exception as e:
        print("UPDATE PROFILE ERROR:", str(e))
        return jsonify({'error': 'Failed to update profile.'}), 500
    finally:
        if 'conn' in locals(): conn.close()

# ==========================================
# 9. مسار جلب أوردرات المستخدم (My Orders)
# ==========================================
@app.route('/api/my-orders', methods=['GET'])
@token_required
def get_user_orders(current_user_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        query = """
            SELECT ORDER_ID, status, total, ordered_at, expected_time, delivery_fee, TABLE_ID, order_type 
            FROM [ORDER]
            WHERE CUSTOMER_ID = ?
            ORDER BY ordered_at DESC
        """
        cursor.execute(query, (current_user_id,))
        
        orders = []
        for row in cursor.fetchall():
            mode = row.order_type if hasattr(row, 'order_type') and row.order_type else 'takeaway'

            if not row.order_type:
                if row.delivery_fee and row.delivery_fee > 0:
                    mode = 'delivery'
                elif row.TABLE_ID:
                    mode = 'dine_in'

            orders.append({
                'id': row.ORDER_ID, 'status': row.status, 'totalPrice': float(row.total),
                'timestamp': row.ordered_at.timestamp() * 1000 if row.ordered_at else None,
                'expectedTime': row.expected_time.timestamp() * 1000 if row.expected_time else None,
                'mode': mode, 'tableNum': row.TABLE_ID
            })

        return jsonify(orders), 200

    except Exception as e:
        print("GET ORDERS ERROR:", str(e))
        return jsonify({'error': 'Failed to load orders.'}), 500
    finally:
        if 'conn' in locals(): conn.close()

# ==========================================
# 10. مسار إضافة تقييم (Submit Feedback)
# ==========================================
@app.route('/api/feedback', methods=['POST', 'OPTIONS'])
@token_required
def submit_feedback(current_user_id):
    if request.method == 'OPTIONS': return jsonify({}), 200
    
    try:
        data = request.get_json()
        customer_id = current_user_id 
        raw_order_id = data.get('order_id')
        rating = data.get('rating')
        comment = data.get('comment', '')
        tags = data.get('tags', '')

        if not customer_id or not rating:
            return jsonify({'error': 'Customer ID and Rating are required'}), 400

        order_id = None
        if raw_order_id and str(raw_order_id).lower() not in ['nan', 'null', 'none', '']:
            try: order_id = int(raw_order_id)
            except ValueError: pass

        conn = get_db_connection()
        cursor = conn.cursor()

        insert_query = """
            INSERT INTO [FEEDBACKS] ([ORDER_ID], [CUSTOMER_ID], [rating], [comment], [tags], [created_at])
            VALUES (?, ?, ?, ?, ?, GETDATE())
        """
        cursor.execute(insert_query, (order_id, customer_id, rating, comment, tags))
        conn.commit()

        return jsonify({'message': 'Feedback submitted successfully!'}), 201

    except Exception as e:
        print("FEEDBACK ERROR:", str(e))
        return jsonify({'error': 'Failed to submit feedback.'}), 500
    finally:
        if 'conn' in locals(): conn.close()

# ==========================================
# 11. مسار إلغاء الأوردر (Cancel Order)
# ==========================================
@app.route('/api/orders/<int:order_id>/cancel', methods=['PUT', 'OPTIONS'])
@token_required
def cancel_order(current_user_id, order_id):
    if request.method == 'OPTIONS': return jsonify({}), 200
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT TABLE_ID, CUSTOMER_ID FROM [ORDER] WHERE ORDER_ID = ? AND CUSTOMER_ID = ?", (order_id, current_user_id))
        order_info = cursor.fetchone()

        if not order_info:
             return jsonify({'error': 'Order not found or unauthorized.'}), 404

        update_query = "UPDATE [ORDER] SET status = 'Cancelled', updated_at = GETDATE() WHERE ORDER_ID = ?"
        cursor.execute(update_query, (order_id,))

        if order_info.TABLE_ID:
            table_id = order_info.TABLE_ID
            customer_id = order_info.CUSTOMER_ID
            
            cancel_res_query = """
                UPDATE RESERVATION 
                SET status = 'Cancelled' 
                WHERE TABLE_ID = ? AND CUSTOMER_ID = ? AND status = 'Confirmed'
            """
            cursor.execute(cancel_res_query, (table_id, customer_id))

        conn.commit()

        return jsonify({'message': 'Order cancelled successfully.', 'order_id': order_id}), 200

    except Exception as e:
        if 'conn' in locals(): conn.rollback()
        print("CANCEL ORDER ERROR:", str(e))
        return jsonify({'error': 'Failed to cancel order.'}), 500
    finally:
        if 'conn' in locals(): conn.close()

# ==========================================
# 12. مسار حذف الحساب (Delete Account)
# ==========================================
@app.route('/api/profile', methods=['DELETE', 'OPTIONS'])
@token_required
def delete_account(current_user_id):
    if request.method == 'OPTIONS': return jsonify({}), 200
    try:
        data = request.get_json()
        password = data.get('password')

        if not password:
            return jsonify({'error': 'Password is required to delete account'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT password_hash FROM CUSTOMER WHERE CUSTOMER_ID = ?", (current_user_id,))
        user = cursor.fetchone()

        if not user or not check_password_hash(user[0], password):
            return jsonify({'error': 'Incorrect password. Account deletion failed.'}), 401

        cursor.execute("DELETE FROM CUSTOMER WHERE CUSTOMER_ID = ?", (current_user_id,))
        conn.commit()

        return jsonify({'message': 'Account deleted successfully'}), 200

    except Exception as e:
        if 'conn' in locals(): conn.rollback()
        print("DELETE ACCOUNT ERROR:", str(e))
        return jsonify({'error': 'Failed to delete account.'}), 500
    finally:
        if 'conn' in locals(): conn.close()

if __name__ == '__main__':
    is_prod = os.environ.get('FLASK_ENV') == 'production'
    # ملاحظة: السيرفرات السحابية بتتجاهل السطر ده وبتستخدم Gunicorn
    app.run(debug=not is_prod, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))