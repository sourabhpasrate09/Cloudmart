CREATE DATABASE IF NOT EXISTS cloudmart CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cloudmart;

CREATE TABLE IF NOT EXISTS products (
  id INT PRIMARY KEY,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  price DECIMAL(12,2) NOT NULL,
  emoji VARCHAR(16),
  stock INT DEFAULT 20,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  brand VARCHAR(150),
  original_price DECIMAL(12,2),
  discount_percent DECIMAL(6,2),
  rating DECIMAL(3,2),
  review_count INT DEFAULT 0,
  category VARCHAR(100),
  image_path VARCHAR(255),
  source_screenshot VARCHAR(500),
  specs_json JSON
) CHARACTER SET utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(150) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50) NOT NULL,
  items JSON NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  status VARCHAR(30) DEFAULT 'PLACED',
  address TEXT,
  notes TEXT,
  payment_method VARCHAR(30) DEFAULT 'COD',
  payment_status VARCHAR(30) DEFAULT 'PENDING',
  payment_reference VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4;
