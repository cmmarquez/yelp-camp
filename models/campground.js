const mongoose = require("mongoose");

const campgroundSchema = new mongoose.Schema({
    name: String,
    price: String,
    image: String,
    imageID: String,
    description: String,
    location: String,
    lat: Number,
    lng: Number,
    createdAt: { type: Date, default: Date.now },
    author: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        username: String
    },
    comments: [
        { type: mongoose.Schema.Types.ObjectID, ref: "Comment" }
    ]
});

module.exports = mongoose.model("Campground", campgroundSchema);