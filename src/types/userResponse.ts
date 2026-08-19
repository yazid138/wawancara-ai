type UserResponse = {
  id: number;
  name: string;
  username: string;
  role: string;
  companyId: number | null;
  createdAt: Date;
};

export default UserResponse;
