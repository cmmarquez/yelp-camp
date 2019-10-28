const middlewareObj = {};
const Campground = require("../models/campground");
const Comment = require("../models/comment");

middlewareObj.isLoggedIn = (request, response, next) => {
    if (request.isAuthenticated()) {
        return next();
    }
    request.flash("error", "Please login!");
    response.redirect("/login");
};

middlewareObj.checkCampgroundOwnership = (request, response, next) => {
    if (request.isAuthenticated()) {
        Campground.findById(request.params.id, (error, foundCampground) => {
            if (error || !foundCampground) {
                request.flash("error", "Campground not found!");
                response.redirect("back");
            } else {
                if (foundCampground.author.id.equals(request.user._id) || request.user.isAdmin) {
                    next();
                } else {
                    request.flash("error", "You are not authorized to perform this operation!");
                    response.redirect("back");
                }
            }
        });
    } else {
        request.flash("error", "Please login!");
        response.redirect("back");
    }
};

middlewareObj.checkCommentOwnership = (request, response, next) => {
    if (request.isAuthenticated()) {
        Comment.findById(request.params.comment_id, (error, foundComment) => {
            if (error || !foundComment) {
                request.flash("error", "Comment not found!");
                response.redirect("back");
            } else {
                if (foundComment.author.id.equals(request.user._id) || request.user.isAdmin) {
                    next();
                } else {
                    request.flash("error", "You are not authorized to perform this operation!");
                    response.redirect("back");
                }
            }
        });
    } else {
        request.flash("error", "Please login!");
        response.redirect("back");
    }
};

module.exports = middlewareObj;