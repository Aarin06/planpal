import { User } from "../models/users.js";
import { Router } from "express";
import bcrypt from "bcrypt";
import { Op } from "sequelize";
import { isAuthenticated } from "../middleware/helpers.js";

export const usersRouter = Router();

usersRouter.post("/signup", async (req, res) => {
  const user = User.build({
    username: req.body.username,
  });
  // generate password - salted and hashed
  const password = req.body.password;
  const salt = bcrypt.genSaltSync(10);
  user.password = bcrypt.hashSync(password, salt);
  try {
    await user.save();
  } catch (err) {
    return res.status(422).json({ error: "User creation failed." });
  }
  req.session.userId = user.id;
  return res.json({
    username: user.username,
  });
});

usersRouter.post("/signin", async (req, res) => {
  const user = await User.findOne({
    where: {
      username: req.body.username,
    },
  });
  if (user === null) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  // password incorrect
  if (!bcrypt.compareSync(req.body.password, user.password)) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }
  req.session.userId = user.id;
  return res.json(user);
});

usersRouter.get("/signout", isAuthenticated, function (req, res) {
  req.session.destroy();
  return res.json({ message: "Signed out." });
});

// need to change when we store session id instead of entire user
usersRouter.get("/me", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ errors: "Not Authenticated" });
  }
  const userId = req.user.id;
  const user = await User.findByPk(userId, {
    attributes: ['username', 'profile', 'tier', 'id']
  });
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  return res.json(user);
});


usersRouter.get("/", isAuthenticated, async (req, res) => {
  const users = await User.findAll({
    where: {
      id: {
        [Op.ne]:  req.user.id
      }
    },
    attributes: ['id','username', 'profile', 'tier']
  });

  return res.json(users);
});
