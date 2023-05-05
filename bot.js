require("dotenv").config();
const Telebot = require("telebot");
const mongo_pass = process.env.MONGO_PASS;
const mongo_user = process.env.MONGO_USER;
const bot_token = process.env.BOT_TOKEN;
const seller_id = "1219272166";
const mongoose = require("mongoose");
const mongoURI = `mongodb+srv://${mongo_user}:${mongo_pass}@cluster0.6y5kszs.mongodb.net/botDB`;

const inventorySchema = mongoose.Schema({
  Name: String,
  Price: Number,
  Stock: Number,
  Type: String,
});

const userSchema = mongoose.Schema({
  UserId: String,
  UserName: String,
  Cart: [inventorySchema],
  Orders: [inventorySchema],
});

const UserModel = mongoose.model("User", userSchema);
const inventoryModel = mongoose.model("Inventory", inventorySchema);

mongoose
  .connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("MongoDB Connected");
  })
  .catch((err) => console.log(err));

const bot = new Telebot({ token: bot_token });

bot.on("/start", (msg) => {
  UserModel.find({ UserId: msg.from.id }).then((user) => {
    if (user.length == 0) {
      UserModel.create({
        UserId: msg.from.id,
        UserName: msg.from.username,
        Cart: [],
        Orders: [],
      }).then((user) => {
        if (user) {
          console.log("User Created");
        }
      });
    }
  });
  return bot.sendMessage(
    msg.from.id,
    `Hi ${msg.from.first_name}! This is Ghar ki Dukaan's bot. You can follow the command menu on the left side of your textbox to interact with the bot. Hope you have a great time shopping!`
  );
});

bot.on("/display_inventory", (msg) => {
  inventoryModel.find({}).then((inventory) => {
    let inventoryString = "";
    inventory.forEach((item) => {
      inventoryString += `${item.Name} - Rs${item.Price} per Kg - ${item.Stock}Kg in stock - (${item.Type})\n`;
    });
    return bot.sendMessage(msg.from.id, inventoryString);
  });
});

bot.on("/add_to_cart", (msg) => {
  let itemName = msg.text.split(" ")[1];
  let itemQuantity = msg.text.split(" ")[2];
  inventoryModel.find({ Name: itemName }).then((item) => {
    if (item.length == 0) {
      return bot.sendMessage(msg.from.id, "Item not found");
    } else {
      if (item[0].Stock < itemQuantity) {
        return bot.sendMessage(msg.from.id, "Insufficient stock");
      } else {
        UserModel.find({ UserId: msg.from.id }).then((user) => {
          let cart = user[0].Cart;
          let itemFound = false;
          cart.forEach((cartItem) => {
            if (cartItem.Name == itemName) {
              itemFound = true;
              cartItem.Stock += itemQuantity;
            }
          });
          if (!itemFound) {
            cart.push({
              Name: itemName,
              Price: item[0].Price,
              Stock: itemQuantity,
              Type: item[0].Type,
            });
          }
          UserModel.updateOne({ UserId: msg.from.id }, { Cart: cart }).then(
            (user) => {
              if (user) {
                return bot.sendMessage(msg.from.id, "Item added to cart");
              }
            }
          );
          inventoryModel
            .updateOne(
              { Name: itemName },
              { Stock: item[0].Stock - itemQuantity }
            )
            .then((item) => {
              if (item) {
                console.log("Inventory Updated");
              }
            });
        });
      }
    }
  });
});

bot.on("/show_cart", (msg) => {
  UserModel.find({ UserId: msg.from.id }).then((user) => {
    let totalCartPrice = 0;
    let cart = user[0].Cart;
    if (cart.length == 0) return bot.sendMessage(msg.from.id, "Cart is empty");
    let cartString = "";
    cart.forEach((item) => {
      totalCartPrice += item.Price * item.Stock;
      cartString += `${item.Name} - Rs${item.Price} - ${item.Stock}Kg - (${item.Type})\n`;
    });
    cartString += `Total Price: Rs${totalCartPrice}`;
    return bot.sendMessage(msg.from.id, cartString);
  });
});

bot.on("/order_cart", (msg) => {
  let order = ``;
  UserModel.find({ UserId: msg.from.id }).then((user) => {
    let cart = user[0].Cart;
    if (cart.length == 0) return bot.sendMessage(msg.from.id, "Cart is empty");
    //Empty user cart
    UserModel.updateOne({ UserId: msg.from.id }, { Cart: [] }).then((user) => {
      if (user) {
        console.log("Cart Emptied");
      }
    });
    //Add cart to orders
    let cartString = "Order Details:\n";
    let newOrder = [];
    UserModel.find({ UserId: msg.from.id }).then((user) => {
      let orders = user[0].Orders;
      orders.forEach((item) => {
        newOrder.push({
          Name: item.Name,
          Price: item.Price,
          Stock: item.Stock,
          Type: item.Type,
        });
      });
    });
    cart.forEach((item) => {
      newOrder.push({
        Name: item.Name,
        Price: item.Price,
        Stock: item.Stock,
        Type: item.Type,
      });
      cartString += `${item.Name} - Rs${item.Price} - ${item.Stock}Kg - (${item.Type})\n`;
    });
    UserModel.updateOne({ UserId: msg.from.id }, { Orders: newOrder }).then(
      (user) => {}
    );
    order = cartString;
    bot.sendMessage(msg.from.id, "Order placed!");
    bot.sendMessage(seller_id, cartString);
  });
});

bot.on("/track_orders", (msg) => {
  UserModel.find({ UserId: msg.from.id }).then((user) => {
    let orders = user[0].Orders;
    if (orders.length == 0)
      return bot.sendMessage(msg.from.id, "You have not placed any orders yet");
    let ordersString = "";
    orders.forEach((order) => {
      ordersString += `${order.Name} - Rs${order.Price} - ${order.Stock}Kg - (${order.Type})\n`;
    });
    return bot.sendMessage(msg.from.id, ordersString);
  });
});

bot.start();
