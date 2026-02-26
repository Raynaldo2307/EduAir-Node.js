CREATE DATABASE  IF NOT EXISTS `edu_air_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `edu_air_db`;
-- MySQL dump 10.13  Distrib 8.0.44, for macos15 (arm64)
--
-- Host: localhost    Database: edu_air_db
-- ------------------------------------------------------
-- Server version	9.5.0

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;

--
-- GTID state at the beginning of the backup 
--

SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ '4fb03bfc-eb0d-11f0-8691-3143bde855ee:1-274';

--
-- Table structure for table `attendance`
--

DROP TABLE IF EXISTS `attendance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `school_id` int NOT NULL,
  `student_id` int NOT NULL,
  `class_id` int DEFAULT NULL,
  `recorded_by_user_id` int DEFAULT NULL,
  `shift_type` enum('morning','afternoon','whole_day') NOT NULL,
  `attendance_date` date NOT NULL,
  `clock_in` time DEFAULT NULL,
  `clock_in_lat` decimal(10,8) DEFAULT NULL,
  `clock_in_lng` decimal(11,8) DEFAULT NULL,
  `clock_out` time DEFAULT NULL,
  `clock_out_lat` decimal(10,8) DEFAULT NULL,
  `clock_out_lng` decimal(11,8) DEFAULT NULL,
  `status` enum('present','late','absent','early','excused') NOT NULL,
  `is_early_leave` tinyint(1) NOT NULL DEFAULT '0',
  `source` enum('studentSelf','teacherBatch','adminEdit') NOT NULL,
  `late_reason_code` varchar(50) DEFAULT NULL,
  `device_id` varchar(100) DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `student_id` (`student_id`,`attendance_date`,`shift_type`),
  UNIQUE KEY `uniq_student_date_shift` (`student_id`,`attendance_date`,`shift_type`),
  UNIQUE KEY `uq_attendance_unique` (`school_id`,`student_id`,`attendance_date`,`shift_type`),
  KEY `idx_attendance_student_date` (`student_id`,`attendance_date`),
  KEY `idx_attendance_school_date` (`school_id`,`attendance_date`),
  KEY `fk_attendance_recorded_by` (`recorded_by_user_id`),
  KEY `idx_attendance_class_date` (`class_id`,`attendance_date`),
  CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `attendance_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`),
  CONSTRAINT `fk_attendance_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`),
  CONSTRAINT `fk_attendance_recorded_by` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance`
--

LOCK TABLES `attendance` WRITE;
/*!40000 ALTER TABLE `attendance` DISABLE KEYS */;
INSERT INTO `attendance` VALUES (1,1,1,NULL,NULL,'whole_day','2026-02-04','07:55:00',NULL,NULL,'15:30:00',NULL,NULL,'present',0,'teacherBatch',NULL,NULL,NULL,'2026-02-05 09:38:06','2026-02-18 13:57:16'),(2,1,1,NULL,NULL,'whole_day','2026-02-05','08:35:00',NULL,NULL,'15:20:00',NULL,NULL,'late',0,'teacherBatch',NULL,NULL,NULL,'2026-02-05 09:39:07','2026-02-18 13:57:16'),(3,1,1,NULL,NULL,'whole_day','2026-02-06',NULL,NULL,NULL,NULL,NULL,NULL,'absent',0,'teacherBatch',NULL,NULL,NULL,'2026-02-05 09:39:42','2026-02-18 13:57:16'),(4,1,1,NULL,NULL,'whole_day','2026-02-01','07:55:00',NULL,NULL,'15:30:00',NULL,NULL,'present',0,'teacherBatch',NULL,NULL,NULL,'2026-02-05 10:02:57','2026-02-18 13:57:16'),(5,1,1,NULL,NULL,'whole_day','2026-02-02','08:40:00',NULL,NULL,'15:20:00',NULL,NULL,'late',0,'teacherBatch',NULL,NULL,NULL,'2026-02-05 10:02:57','2026-02-18 13:57:16'),(6,1,1,NULL,NULL,'whole_day','2026-02-03',NULL,NULL,NULL,NULL,NULL,NULL,'absent',0,'teacherBatch',NULL,NULL,NULL,'2026-02-05 10:02:57','2026-02-18 13:57:16'),(10,1,1,NULL,NULL,'whole_day','2026-02-07',NULL,NULL,NULL,NULL,NULL,NULL,'absent',0,'teacherBatch',NULL,NULL,NULL,'2026-02-05 10:02:57','2026-02-18 13:57:16'),(11,1,1,NULL,NULL,'whole_day','2026-02-08','08:05:00',NULL,NULL,'15:00:00',NULL,NULL,'present',0,'teacherBatch',NULL,NULL,NULL,'2026-02-05 10:02:57','2026-02-18 13:57:16'),(12,1,1,NULL,NULL,'whole_day','2026-02-09','08:45:00',NULL,NULL,'15:15:00',NULL,NULL,'late',0,'teacherBatch',NULL,NULL,NULL,'2026-02-05 10:02:57','2026-02-18 13:57:16'),(13,1,1,NULL,NULL,'whole_day','2026-02-10','07:52:00',NULL,NULL,'15:40:00',NULL,NULL,'present',0,'teacherBatch',NULL,NULL,NULL,'2026-02-05 10:02:57','2026-02-18 13:57:16');
/*!40000 ALTER TABLE `attendance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_history`
--

DROP TABLE IF EXISTS `attendance_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attendance_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `attendance_id` int NOT NULL,
  `previous_status` enum('present','late','absent','early','excused') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_status` enum('present','late','absent','early','excused') COLLATE utf8mb4_unicode_ci NOT NULL,
  `changed_by_user_id` int NOT NULL,
  `source` enum('studentSelf','teacherBatch','adminEdit') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_attendance_history_attendance` (`attendance_id`),
  KEY `fk_attendance_history_user` (`changed_by_user_id`),
  CONSTRAINT `fk_attendance_history_attendance` FOREIGN KEY (`attendance_id`) REFERENCES `attendance` (`id`),
  CONSTRAINT `fk_attendance_history_user` FOREIGN KEY (`changed_by_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_history`
--

LOCK TABLES `attendance_history` WRITE;
/*!40000 ALTER TABLE `attendance_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `attendance_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `classes`
--

DROP TABLE IF EXISTS `classes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `classes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `school_id` int NOT NULL,
  `name` varchar(50) DEFAULT NULL,
  `grade_level` varchar(20) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_classes_school` (`school_id`),
  CONSTRAINT `classes_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `fk_classes_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `classes`
--

LOCK TABLES `classes` WRITE;
/*!40000 ALTER TABLE `classes` DISABLE KEYS */;
INSERT INTO `classes` VALUES (1,1,'10A','Grade 10','2026-02-18 13:56:14','2026-02-18 13:56:14'),(2,1,'Grade 9 Red','Grade 9','2026-02-19 16:50:15','2026-02-19 16:50:15');
/*!40000 ALTER TABLE `classes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `parent_students`
--

DROP TABLE IF EXISTS `parent_students`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `parent_students` (
  `id` int NOT NULL AUTO_INCREMENT,
  `parent_user_id` int NOT NULL,
  `student_id` int NOT NULL,
  `relationship_type` enum('mother','father','guardian','other') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_primary_guardian` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_parent_student` (`parent_user_id`,`student_id`),
  UNIQUE KEY `uq_parent_students_parent_student` (`parent_user_id`,`student_id`),
  KEY `fk_parent_students_student` (`student_id`),
  CONSTRAINT `fk_parent_students_parent` FOREIGN KEY (`parent_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_parent_students_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `parent_students`
--

LOCK TABLES `parent_students` WRITE;
/*!40000 ALTER TABLE `parent_students` DISABLE KEYS */;
/*!40000 ALTER TABLE `parent_students` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `schools`
--

DROP TABLE IF EXISTS `schools`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schools` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `moey_school_code` varchar(50) DEFAULT NULL,
  `short_code` varchar(50) DEFAULT NULL,
  `parish` varchar(100) NOT NULL,
  `school_type` enum('basic','primary','prep','secondary','all_age','heart_nta','other') NOT NULL DEFAULT 'primary',
  `is_shift_school` tinyint(1) NOT NULL DEFAULT '0',
  `default_shift_type` enum('morning','afternoon','whole_day') NOT NULL DEFAULT 'whole_day',
  `latitude` decimal(9,6) DEFAULT NULL,
  `longitude` decimal(9,6) DEFAULT NULL,
  `radius_meters` int NOT NULL DEFAULT '150',
  `timezone` varchar(50) NOT NULL DEFAULT 'America/Jamaica',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_school_name_parish` (`name`,`parish`),
  UNIQUE KEY `uq_schools_moey_school_code` (`moey_school_code`),
  UNIQUE KEY `uq_schools_short_code` (`short_code`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `schools`
--

LOCK TABLES `schools` WRITE;
/*!40000 ALTER TABLE `schools` DISABLE KEYS */;
INSERT INTO `schools` VALUES (1,'Papine High',NULL,NULL,'Kingston','secondary',0,'whole_day',18.012345,-76.789040,200,'America/Jamaica',1,'2026-02-18 13:55:31','2026-02-19 19:51:13'),(2,'Maggotty High',NULL,NULL,'Kingston','primary',0,'whole_day',18.012345,-76.789040,200,'America/Jamaica',1,'2026-02-18 13:55:31','2026-02-19 20:02:00'),(3,'St. Catherine High',NULL,NULL,'St. Catherine','secondary',0,'whole_day',17.997000,-76.876500,150,'America/Jamaica',1,'2026-02-19 16:38:28','2026-02-19 19:50:34');
/*!40000 ALTER TABLE `schools` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `student_classes`
--

DROP TABLE IF EXISTS `student_classes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `student_classes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `class_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_student_class` (`student_id`,`class_id`),
  UNIQUE KEY `uq_student_class` (`student_id`,`class_id`),
  KEY `idx_student_classes_student` (`student_id`),
  KEY `idx_student_classes_class` (`class_id`),
  CONSTRAINT `fk_student_classes_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`),
  CONSTRAINT `fk_student_classes_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `student_classes`
--

LOCK TABLES `student_classes` WRITE;
/*!40000 ALTER TABLE `student_classes` DISABLE KEYS */;
/*!40000 ALTER TABLE `student_classes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `students`
--

DROP TABLE IF EXISTS `students`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `students` (
  `id` int NOT NULL AUTO_INCREMENT,
  `school_id` int NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) NOT NULL,
  `student_code` varchar(30) DEFAULT NULL,
  `sex` enum('male','female') DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `current_shift_type` enum('morning','afternoon','whole_day') NOT NULL DEFAULT 'whole_day',
  `phone_number` varchar(20) DEFAULT NULL,
  `status` enum('active','inactive','graduated') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `homeroom_class_id` int DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `user_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  UNIQUE KEY `uq_students_school_student_code` (`school_id`,`student_code`),
  KEY `class_id` (`homeroom_class_id`),
  CONSTRAINT `fk_students_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `students_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `students_ibfk_2` FOREIGN KEY (`homeroom_class_id`) REFERENCES `classes` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `students`
--

LOCK TABLES `students` WRITE;
/*!40000 ALTER TABLE `students` DISABLE KEYS */;
INSERT INTO `students` VALUES (1,1,'Ray','Brown',NULL,NULL,NULL,'whole_day','8765551234','active','2026-02-04 21:55:26',1,'2026-02-18 18:17:00',NULL),(2,1,'Shanice','Davis',NULL,NULL,NULL,'whole_day',NULL,'active','2026-02-19 21:52:14',2,'2026-02-20 02:39:26',2),(3,1,'Malik','Grant',NULL,NULL,NULL,'whole_day',NULL,'active','2026-02-19 21:52:14',2,'2026-02-20 02:39:30',3),(4,1,'Tia','Clarke',NULL,NULL,NULL,'whole_day',NULL,'active','2026-02-19 21:52:14',2,'2026-02-20 02:39:33',4);
/*!40000 ALTER TABLE `students` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `teacher_classes`
--

DROP TABLE IF EXISTS `teacher_classes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `teacher_classes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `teacher_id` int NOT NULL,
  `class_id` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_teacher_class` (`teacher_id`,`class_id`),
  UNIQUE KEY `uq_teacher_class` (`teacher_id`,`class_id`),
  KEY `idx_teacher_classes_teacher` (`teacher_id`),
  KEY `idx_teacher_classes_class` (`class_id`),
  CONSTRAINT `fk_teacher_classes_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`),
  CONSTRAINT `fk_teacher_classes_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `teachers` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `teacher_classes`
--

LOCK TABLES `teacher_classes` WRITE;
/*!40000 ALTER TABLE `teacher_classes` DISABLE KEYS */;
INSERT INTO `teacher_classes` VALUES (1,1,2,'2026-02-19 16:54:06','2026-02-23 18:11:31');
/*!40000 ALTER TABLE `teacher_classes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `teachers`
--

DROP TABLE IF EXISTS `teachers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `teachers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `school_id` int NOT NULL,
  `homeroom_class_id` int DEFAULT NULL,
  `staff_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `department` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `employment_type` enum('full_time','part_time','substitute','contract') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'full_time',
  `hire_date` date DEFAULT NULL,
  `current_shift_type` enum('morning','afternoon','whole_day') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'whole_day',
  `status` enum('active','inactive','on_leave','retired') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  UNIQUE KEY `uq_teachers_school_staff_code` (`school_id`,`staff_code`),
  KEY `idx_teachers_school` (`school_id`),
  KEY `idx_teachers_school_status` (`school_id`,`status`),
  KEY `fk_teachers_homeroom_class_id` (`homeroom_class_id`),
  CONSTRAINT `fk_teachers_homeroom_class` FOREIGN KEY (`homeroom_class_id`) REFERENCES `classes` (`id`),
  CONSTRAINT `fk_teachers_homeroom_class_id` FOREIGN KEY (`homeroom_class_id`) REFERENCES `classes` (`id`),
  CONSTRAINT `fk_teachers_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `fk_teachers_school_id` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`),
  CONSTRAINT `fk_teachers_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_teachers_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `teachers`
--

LOCK TABLES `teachers` WRITE;
/*!40000 ALTER TABLE `teachers` DISABLE KEYS */;
INSERT INTO `teachers` VALUES (1,1,1,NULL,'STC-MATH-001',NULL,'full_time','2020-09-01','whole_day','active','2026-02-19 16:51:21','2026-02-19 16:51:21');
/*!40000 ALTER TABLE `teachers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `school_id` int NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('student','teacher','admin','principal','parent') NOT NULL,
  `first_name` varchar(100) DEFAULT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `fk_users_school` (`school_id`),
  CONSTRAINT `fk_users_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,1,'mr.brown@stcath.edu.jm','hash1','teacher','Mark','Brown','2026-02-19 21:40:48','2026-02-19 21:40:48'),(2,1,'shanice.davis@student.jm','hash2','student','Shanice','Davis','2026-02-19 21:40:48','2026-02-19 21:40:48'),(3,1,'malik.grant@student.jm','hash3','student','Malik','Grant','2026-02-19 21:40:48','2026-02-19 21:40:48'),(4,1,'tia.clarke@student.jm','hash4','student','Tia','Clarke','2026-02-19 21:40:48','2026-02-19 21:40:48'),(5,1,'ms.campbell@parent.jm','hash5','parent','Lisa','Campbell','2026-02-19 21:40:48','2026-02-19 21:40:48');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-02-23 18:53:48
