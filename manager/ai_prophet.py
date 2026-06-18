import pandas as pd
import numpy as np
from prophet import Prophet
import pyodbc

DB_CONFIG = {
    "DRIVER": "{ODBC Driver 17 for SQL Server}",
    "SERVER": "db33942.public.databaseasp.net,1433",
    "DATABASE": "db33942",
    "UID": "db33942",
    "PWD": "project2026",
    "Encrypt": "yes",
    "TrustServerCertificate": "yes"
}

def get_ai_forecasts():
    try:
        conn_str = ";".join([f"{k}={v}" for k, v in DB_CONFIG.items()])
        conn = pyodbc.connect(conn_str)

        query = """
        SELECT CAST(ordered_at AS DATE) AS ds, SUM(total) AS y
        FROM [ORDER]
        WHERE status NOT IN ('New', 'Cancelled')
        GROUP BY CAST(ordered_at AS DATE)
        ORDER BY ds ASC
        """

        data = pd.read_sql(query, conn)
        conn.close()

        if data.empty or len(data) < 7:
            return {"success": False, "message": "Not enough data"}

        # تحويل التاريخ
        data['ds'] = pd.to_datetime(data['ds'])

        # تدريب الموديل
        model = Prophet(
            seasonality_mode='multiplicative',
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False
        )
        model.add_country_holidays(country_name='EG')
        model.fit(data)

        # ===== 1. KPIs Calculations =====
        future_30 = model.make_future_dataframe(periods=30)
        forecast_30 = model.predict(future_30)
        future_only_30 = forecast_30.tail(30)
        
        next_7 = round(future_only_30.head(7)['yhat'].sum(), 2)
        next_30 = round(future_only_30['yhat'].sum(), 2)

        future_year_full = model.make_future_dataframe(periods=365)
        forecast_year_full = model.predict(future_year_full)
        next_year = round(forecast_year_full.tail(365)['yhat'].sum(), 2)

        # Accuracy
        y_true = data['y'].values
        y_pred = forecast_30['yhat'][:len(data)].values
        mae = np.mean(np.abs(y_true - y_pred))
        mean_y = np.mean(y_true)
        accuracy = round(100 - (mae / mean_y * 100), 1) if mean_y > 0 else 0

        # ===== 2. Historical vs Future Data (Monthly) =====
        data['month'] = data['ds'].dt.to_period('M')
        hist_monthly = data.groupby('month')['y'].sum().reset_index()
        hist_monthly['month'] = hist_monthly['month'].astype(str)

        # الحفاظ على future_only عشان الجزء الرابع (YoY) يفضل شغال سليم
        future_only = forecast_year_full.tail(365).copy()

        # التعديل: حساب التوقعات للشهور كاملة عشان نتجنب سقوط الشهر الحالي
        current_month_str = pd.to_datetime(data['ds'].max()).strftime('%Y-%m')
        
        forecast_year_full['month'] = forecast_year_full['ds'].dt.to_period('M')
        all_fut_monthly = forecast_year_full.groupby('month')['yhat'].sum().reset_index()
        all_fut_monthly['month'] = all_fut_monthly['month'].astype(str)
        
        # فلترة التوقعات عشان تبدأ من الشهر الحالي وتكون كاملة
        fut_monthly = all_fut_monthly[all_fut_monthly['month'] >= current_month_str].head(12)

        combined_timeline = pd.merge(hist_monthly, fut_monthly, on='month', how='outer')
        combined_timeline.rename(columns={'y': 'actual', 'yhat': 'predicted'}, inplace=True)
        
        # ترتيب وعرض آخر 6 شهور ماضي و 12 شهر مستقبل
        combined_timeline = combined_timeline.sort_values('month').tail(18)
        
        timeline_chart = []
        for _, row in combined_timeline.iterrows():
            act_val = row['actual']
            pre_val = row['predicted']
            timeline_chart.append({
                "date": row['month'],
                "actual": round(act_val, 2) if pd.notna(act_val) else None,
                "predicted": round(pre_val, 2) if pd.notna(pre_val) else None # 👈 تم تغيير 0 لـ None عشان الشارت مينزلش تحت
            })

        # ===== 3. Day of Week Analysis =====
        data['day_name'] = data['ds'].dt.day_name()
        weekly_avg = data.groupby('day_name')['y'].mean().reindex([
            'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
        ]).fillna(0).reset_index()

        weekly_chart = []
        for _, row in weekly_avg.iterrows():
            weekly_chart.append({
                "day": row['day_name'][:3],
                "avg_sales": round(row['y'], 2)
            })

        # ===== 4. Year-over-Year Comparison =====
        current_year = pd.Timestamp.now().year
        last_year = current_year - 1
        
        all_data = pd.DataFrame({
            'date': data['ds'].tolist() + future_only['ds'].tolist(),
            'sales': data['y'].tolist() + future_only['yhat'].tolist()
        })
        all_data['year'] = all_data['date'].dt.year
        all_data['month_num'] = all_data['date'].dt.month
        
        yearly_grouped = all_data.groupby(['year', 'month_num'])['sales'].sum().reset_index()
        
        yoy_chart = []
        months_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        for month_idx in range(1, 13):
            ly_sales = yearly_grouped[(yearly_grouped['year'] == last_year) & (yearly_grouped['month_num'] == month_idx)]['sales'].sum()
            cy_sales = yearly_grouped[(yearly_grouped['year'] == current_year) & (yearly_grouped['month_num'] == month_idx)]['sales'].sum()
            
            yoy_chart.append({
                "month": months_names[month_idx-1],
                "last_year": round(ly_sales, 2),
                "current_year": round(cy_sales, 2)
            })

        return {
            "success": True,
            "accuracy": accuracy,
            "next_7_days": next_7,
            "next_30_days": next_30,
            "next_year": next_year,
            "charts": {
                "timeline": timeline_chart,
                "weekly": weekly_chart,
                "yoy": yoy_chart
            }
        }

    except Exception as e:
        print("AI ERROR:", e)
        return {"success": False, "message": str(e)}