const express = require("express");
const router = express.Router();
const middleware = require("../middleware");
const Campground = require("../models/campground");
const Comment = require("../models/comment");

//Google Maps
const NodeGeocoder = require("node-geocoder");
const options = {
    apiKey: process.env.GEOCODER_API_KEY,
    formatter: null,
    httpAdapter: "https",
    provider: "google"
};
const geocoder = NodeGeocoder(options);

//Image Upload
const multer = require("multer");
const storage = multer.diskStorage({
    filename: (request, file, callback) => {
        callback(null, Date.now() + file.originalname);
    }
});
const imageFilter = (request, file, callback) => {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return callback(new Error("Only image files are allowed!"), false);
    }
    callback(null, true);
};
const upload = multer({ storage: storage, fileFilter: imageFilter });
const cloudinary = require("cloudinary");
cloudinary.config({
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    cloud_name: process.env.CLOUDINARY_USERNAME
});

//Search Campgrounds
escapeRegex = (text) => {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

router.get("/", (request, response) => {
    let noMatch = null;
    if (request.query.search) {
        const regex = new RegExp(escapeRegex(request.query.search), "gi");
        Campground.find({ name: regex }, (error, allCampgrounds) => {
            if (error || !allCampgrounds) {
                console.log("Campground.find() Error:");
                console.log(error);
                return response.redirect("back");
            }
            if (allCampgrounds.length < 1) {
                noMatch = "No campgrounds match that query. Please try again.";
            }
            response.render("campgrounds/index", {
                campgrounds: allCampgrounds,
                noMatch: noMatch,
                page: "campgrounds"
            });

        });
    } else {
        Campground.find({}, (error, allCampgrounds) => {
            if (error || !allCampgrounds) {
                console.log("Campground.find() Error:");
                console.log(error);
                return response.redirect("back");
            }
            response.render("campgrounds/index", {
                campgrounds: allCampgrounds,
                noMatch: noMatch,
                page: "campgrounds"
            });
        });
    }
});

router.get("/new", middleware.isLoggedIn, (request, response) => {
    response.render("campgrounds/new");
});

router.post("/", middleware.isLoggedIn, upload.single("campground[image]"), (request, response) => {
    request.body.campground.author = {
        id: request.user._id,
        username: request.user.username
    };
    geocoder.geocode(request.body.campground.location, (error, data) => {
        if (error || !data.length) {
            request.flash("error", "Invalid address!");
            return response.redirect("back");
        }
        request.body.campground.location = data[0].formattedAddress;
        request.body.campground.lat = data[0].latitude;
        request.body.campground.lng = data[0].longitude;
        cloudinary.v2.uploader.upload(request.file.path, (error, result) => {
            if (error || !result) {
                request.flash("error", error.message);
                return response.redirect("back");
            }
            request.body.campground.image = result.secure_url;
            request.body.campground.imageID = result.public_id;
            Campground.create(request.body.campground, (error) => {
                if (error) {
                    console.log("Campground.create() Error:");
                    console.log(error);
                    return response.redirect("back");
                }
                request.flash("success", "Successfully added campground!");
                response.redirect("/campgrounds");

            });
        });
    });
});

router.get("/:id", (request, response) => {
    Campground.findById(request.params.id).populate("comments").exec((error, foundCampground) => {
        if (error || !foundCampground) {
            console.log("Campground.findById() Error:");
            console.log(error);
            return response.redirect("back");
        }
        response.render("campgrounds/show", { campground: foundCampground });
    });
});

router.get("/:id/edit", middleware.checkCampgroundOwnership, (request, response) => {
    Campground.findById(request.params.id, (error, foundCampground) => {
        if (error || !foundCampground) {
            console.log("Campground.findById() Error:");
            console.log(error);
            return response.redirect("back");
        }
        response.render("campgrounds/edit", { campground: foundCampground });
    });
});

router.put("/:id", middleware.checkCampgroundOwnership, upload.single("campground[image]"), (request, response) => {
    const name = request.body.campground.name;
    const price = request.body.campground.price;
    const description = request.body.campground.description;
    geocoder.geocode(request.body.campground.location, (error, data) => {
        if (error || !data.length) {
            request.flash("error", "Invalid address!");
            return response.redirect("back");
        }
        const location = data[0].formattedAddress;
        const lat = data[0].latitude;
        const lng = data[0].longitude;
        Campground.findById(request.params.id, async (error, foundCampground) => {
            foundCampground.name = name;
            foundCampground.price = price;
            foundCampground.description = description;
            foundCampground.location = location;
            foundCampground.lat = lat;
            foundCampground.lng = lng;
            if (error) {
                console.log("Campground.findById() Error:");
                console.log(error);
                return response.redirect("back");
            }
            if (request.file) {
                try {
                    await cloudinary.v2.uploader.destroy(foundCampground.imageID);
                    const result = await cloudinary.v2.uploader.upload(request.file.path);
                    foundCampground.imageID = result.public_id;
                    foundCampground.image = result.secure_url;
                } catch (error) {
                    request.flash("error", error.message);
                    return response.redirect("back");
                }
            }
            foundCampground.save();
            request.flash("success", "Successfully edited campground!");
            response.redirect("/campgrounds/" + request.params.id);
        });
    });
});

router.delete("/:id", middleware.checkCampgroundOwnership, (request, response) => {
    Campground.findById(request.params.id, async (error, removedCampground) => {
        if (error || !removedCampground) {
            console.log("Campground.findById() Error:");
            console.log(error);
            return response.redirect("back");
        }
        try {
            await cloudinary.v2.uploader.destroy(removedCampground.imageID);
            removedCampground.remove();
            Comment.deleteMany({ _id: { $in: removedCampground.comments } }, (error) => {
                if (error) {
                    console.log("Comment.deleteMany() Error:");
                    console.log(error);
                    return response.redirect("back");
                }
                request.flash("success", "Successfully deleted campground!");
                response.redirect("/campgrounds");
            });
        } catch (error) {
            if (error) {
                request.flash("error", error.message);
                return response.redirect("back");
            }
        }
    });
});

module.exports = router;