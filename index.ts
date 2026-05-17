import "dotenv/config";
import http from "http";
import app from "@/app";
import config from "@/config";
import initializeSocket from "@/socket";

const server = http.createServer(app);

initializeSocket(server);

server.listen(config.port, () => {
  console.log(`Server is running on ${config.baseUrl}:${config.port}`);
});
