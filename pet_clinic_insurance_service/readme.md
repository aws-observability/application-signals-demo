
``` shell
python manage.py migrate --database=postgresql
python manage.py loaddata initial_data.json --database=default
python manage.py loaddata initial_data.json --database=postgresql
```