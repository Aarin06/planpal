import { Router } from "express";
import { User } from "../models/users.js";
import Stripe from "stripe";
import express from "express";
import { isAuthenticated } from "../middleware/helpers.js";

const stripe = Stripe(
  "sk_test_51O2E02LQcW3FBSVStOzg3W2vQdER2unzsBBvtS1YCupSySUaaGoZ1mLNQFfj2tlNr8lCHF6hSKIvgGIl2ZMs7iXP003vwIuwaD",
);
export const stripeRouter = Router();

const endpointSecret =
  "whsec_009dd382c29ccbd8be4017cbd52e4370e4cb6907a09fcc1c0db8f638f91b1945";

stripeRouter.post(
  "/webhook",
  express.raw({ type: "application/json" }), isAuthenticated,
  async (req, res) => {
    const sig = req.headers["stripe-signature"];

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object;
        const userId = session.metadata.userId;
        console.log("Payment was successful for user ID:", userId);
        const user = await User.findByPk(userId);
        if (!user) {
          return res.status(404).json({ error: "No user found" });
        }
        user.tier = 2;
        await user.save();
        console.log("here is the updated user");
        console.log(user);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 res to acknowledge receipt of the event
    res.send();
  },
);

stripeRouter.post(
  "/create-checkout-session",
  express.json(),
  isAuthenticated,
  async (req, res) => {
    try {
      const product = await stripe.products.create({
        name: "Travel Master",
        images: [
          "https://media.self.com/photos/5f0885ffef7a10ffa6640daa/4:3/w_5240,h_3929,c_limit/travel_plane_corona.jpeg",
        ],
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: 499,
        currency: "usd",
      });

      if (req.user?.id) {
        console.log("i am here for");
        console.log(req.user.id);
        const session = await stripe.checkout.sessions.create({
          line_items: [
            {
              // Provide the exact Price ID (for example, pr_1234) of the product you want to sell
              price: price.id,
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: `http://localhost:4200/home`,
          cancel_url: `http://localhost:4200/payment/error`,
          metadata: {
            userId: req.user.id,
          },
        });
        return res.json({ url: session.url });
      }
      res.status(401).json({ errors: "Not Authenticated" });
    } catch (err) {
      return res.status(500).json({ error: err });
    }
  },
);