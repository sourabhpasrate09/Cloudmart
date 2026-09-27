import pymysql
from .config import *
def conn(): return pymysql.connect(host=DB_HOST,port=DB_PORT,user=DB_USER,password=DB_PASSWORD,database=DB_NAME,charset="utf8mb4",cursorclass=pymysql.cursors.DictCursor,autocommit=True)
