variable "aws_region" {
  default = "ap-south-1"
}

variable "project_name" {
  default = "cloudmart"
}

variable "vpc_cidr" {
  default = "10.40.0.0/16"
}

variable "db_username" {
  default = "cloudmart_user"
}

variable "db_password" {
  sensitive = true
}

variable "backend_image" {
  description = "Container image URI for CloudMart backend"
  type        = string
}

variable "frontend_image" {
  description = "Container image URI for CloudMart frontend"
  type        = string
}
