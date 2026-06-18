# استخدام نسخة بايثون خفيفة
FROM python:3.10-slim

# تسطيب أدوات النظام المطلوبة وتعريفات Microsoft SQL Server ODBC
RUN apt-get update && apt-get install -y curl apt-transport-https gnupg2 \
    && curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - \
    && curl https://packages.microsoft.com/config/debian/11/prod.list > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 unixodbc-dev \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

# إنشاء مستخدم جديد بصلاحيات محدودة وتجهيز البيئة لـ Hugging Face
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

# تحديد مسار العمل داخل مجلد المستخدم
WORKDIR $HOME/app

# نسخ ملف المكتبات وتسطيبه مع التأكد من تحديث pip وتثبيت gunicorn
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir gunicorn \
    && pip install --no-cache-dir -r requirements.txt

# نسخ باقي ملفات المشروع وإعطاء الصلاحيات للمستخدم
COPY --chown=user . $HOME/app

# تشغيل السيرفر باستخدام Gunicorn على البورت الخاص بـ Hugging Face (7860)
CMD ["gunicorn", "--bind", "0.0.0.0:7860", "app:app"]