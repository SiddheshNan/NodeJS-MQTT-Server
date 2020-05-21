require("dotenv").config();

const mongoose = require("mongoose");
const mosca = require("mosca");
const deviceSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    credentials: {
      type: String,
      required: true,
    },
  },
  { minimize: false }
);

const Device = mongoose.model("Devices", deviceSchema);
const isStringJSON = (string) => {
  try {
    JSON.parse(string);
  } catch (e) {
    return false;
  }
  return true;
};

// Creating DB Connection String
const connection_string =
  process.env.DB_IS_USING_AUTH == "true"
    ? `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}/${process.env.DB_DATABASE}`
    : `mongodb://${process.env.DB_HOST}/${process.env.DB_DATABASE}`;

// Conecting to the DB
mongoose.connect(connection_string, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", (error) => console.error(error));
db.once("open", () => {
  console.log("MQTT Server - Connected to Database");
});

const server = new mosca.Server({
  port: 1883,
});

server.on("ready", function () {
  console.log("MQTT Server - Ready");
  server.authenticate = authenticate;
  server.authorizePublish = authorizePublish;
  server.authorizeSubscribe = authorizeSubscribe;
});

server.on("clientConnected", async (client) => {
  console.log("client connected", client.id);
});
server.on("clientDisconnected", async (client) => {
  console.log("Client Disconnected:", client.id);
});
server.on("published", async function (packet, client) {
  try {
    console.log("Published", packet);
    console.log("Client", client);
  } catch (error) {
    console.log(error);
  }

  console.log(
    "Published",
    packet.payload.toString() + " on topic: " + packet.topic
  );
});

////---------------------------------------------------

const authenticate = function (client, username, password, callback) {
  //----------
  if (
    username === process.env.MQTT_MAIN_SERVER_USERNAME &&
    password === process.env.MQTT_MAIN_SERVER_PASS
  ) {
    client.user = username;
    callback(null, 1);
    return;
  }
  /// if it is server

  const authorized = getTheDevice(username, password);
  if (authorized) {
    client.user = username;
    callback(null, authorized);
  } else {
    callback(null, authorized);
  }
};

const authorizePublish = (client, topic, payload, callback) => {
  callback(
    null,
    client.user.replace("@", "") == topic.replace("/", "") ||
      client.user === process.env.MQTT_MAIN_SERVER_USERNAME
  );
};

const authorizeSubscribe = (client, topic, callback) => {
  callback(
    null,
    client.user.replace("@", "") == topic.replace("/", "") ||
      client.user === process.env.MQTT_MAIN_SERVER_USERNAME
  );
};

const getTheDevice = async (username, password) => {
  let device;
  try {
    device = await Device.findOne({
      _id: username,
    });
    if (device == null) {
      return 0;
    } else {
      if (password.toString() == device.credentials.toString()) return 1;
      else return 0;
    }
  } catch (err) {
    console.log(err);
  }
};
