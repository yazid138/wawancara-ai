export default {
	baseUrl: process.env.BASE_URL || "http://localhost",
	port: process.env.PORT || 3000,
	secretKey: process.env.SECRET_KEY || "secretkey",
	db: {
		mysql: {
			host: process.env.MYSQL_HOST || "localhost",
			port: Number(process.env.MYSQL_PORT) || 3306,
			user: process.env.MYSQL_USER || "root",
			password: process.env.MYSQL_PASSWORD || "",
			database: process.env.MYSQL_DATABASE || "wawancara_db",
		}
	}
};
