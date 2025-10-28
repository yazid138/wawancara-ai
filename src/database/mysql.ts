import { Sequelize } from "sequelize";
import config from "@/config";

const sequelize = new Sequelize({
	dialect: "mysql",
	host: config.db.mysql.host,
	port: config.db.mysql.port,
	username: config.db.mysql.user,
	password: config.db.mysql.password,
	database: config.db.mysql.database,
});

export const connectToDB = async () => {
	try {
		await sequelize.authenticate();
		await sequelize.sync();
		console.log("Connection has been established successfully.");
	} catch (error) {
		console.error("Unable to connect to the database:", error);
	}
};

export default sequelize;
