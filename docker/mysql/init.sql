CREATE DATABASE IF NOT EXISTS auth_db;
CREATE DATABASE IF NOT EXISTS user_db;
CREATE DATABASE IF NOT EXISTS vendor_db;
CREATE DATABASE IF NOT EXISTS catalog_db;
CREATE DATABASE IF NOT EXISTS order_db;
CREATE DATABASE IF NOT EXISTS delivery_db;
CREATE DATABASE IF NOT EXISTS admin_db;
CREATE DATABASE IF NOT EXISTS notification_db;
CREATE DATABASE IF NOT EXISTS payment_db;
CREATE DATABASE IF NOT EXISTS rating_db;

-- The MYSQL_USER created by the docker image only gets access to MYSQL_DATABASE
-- (auth_db). Grant it access to all service databases explicitly.
GRANT ALL PRIVILEGES ON auth_db.*         TO 'citymarket'@'%';
GRANT ALL PRIVILEGES ON user_db.*         TO 'citymarket'@'%';
GRANT ALL PRIVILEGES ON vendor_db.*       TO 'citymarket'@'%';
GRANT ALL PRIVILEGES ON catalog_db.*      TO 'citymarket'@'%';
GRANT ALL PRIVILEGES ON order_db.*        TO 'citymarket'@'%';
GRANT ALL PRIVILEGES ON delivery_db.*     TO 'citymarket'@'%';
GRANT ALL PRIVILEGES ON admin_db.*        TO 'citymarket'@'%';
GRANT ALL PRIVILEGES ON notification_db.* TO 'citymarket'@'%';
GRANT ALL PRIVILEGES ON payment_db.*      TO 'citymarket'@'%';
GRANT ALL PRIVILEGES ON rating_db.*       TO 'citymarket'@'%';
FLUSH PRIVILEGES;
