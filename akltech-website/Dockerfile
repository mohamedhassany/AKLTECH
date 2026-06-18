# استخدام نسخة بايثون خفيفة
FROM python:3.10-slim

# تسطيب أدوات النظام المطلوبة وتعريفات Microsoft SQL Server ODBC
RUN apt-get update && apt-get install -y curl apt-transport-https gnupg2 \
    && curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - \
    && curl https://packages.microsoft.com/config/debian/11/prod.list > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 unixodbc-dev \
    && apt-get clean -y

# تحديد مسار العمل
WORKDIR /app

# نسخ ملف المكتبات وتسطيبه
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# نسخ باقي ملفات المشروع
COPY . .

# تشغيل السيرفر باستخدام Gunicorn
CMD gunicorn --bind 0.0.0.0:7860 app:app