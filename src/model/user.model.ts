import { DataTypes, Model } from "sequelize";
import sequelize from "@/database/mysql";

class User extends Model {
	declare id: number;
	declare name: string;
	declare username: string;
	declare password: string;
}

User.init(
	{
		id: {
			type: DataTypes.INTEGER.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		name: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		username: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true,
		},
		password: {
			type: DataTypes.STRING,
			allowNull: false,
		},
	},
	{
		sequelize,
		timestamps: true,
	}
);

export const UserModel = User;
