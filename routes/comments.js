const express = require("express");
const router = express.Router({ mergeParams: true });
const middleware = require("../middleware");
const Campground = require("../models/campground");
const Comment = require("../models/comment");

router.get("/new", middleware.isLoggedIn, (request, response) => {
    Campground.findById(request.params.id, (error, foundCampground) => {
        if (error || !foundCampground) {
            console.log("Campground.findById() Error:");
            console.log(error);
            return response.redirect("back");
        }
        response.render("comments/new", { campground: foundCampground });
    });
});

router.post("/", middleware.isLoggedIn, (request, response) => {
    Campground.findById(request.params.id, (error, foundCampground) => {
        if (error || !foundCampground) {
            console.log("Campground.findById() Error:");
            console.log(error);
            return response.redirect("back");
        }
        Comment.create(request.body.comment, (error, comment) => {
            if (error || !comment) {
                console.log("Comment.create() Error:");
                console.log(error);
                return response.redirect("back");
            }
            comment.author.id = request.user._id;
            comment.author.username = request.user.username;
            comment.save();
            foundCampground.comments.push(comment);
            foundCampground.save();
            request.flash("success", "Successfully added comment!");
            response.redirect("/campgrounds/" + foundCampground._id);
        });
    });
});

router.get("/:comment_id/edit", middleware.checkCommentOwnership, (request, response) => {
    Comment.findById(request.params.comment_id, (error, foundComment) => {
        if (error || !foundComment) {
            console.log("Comment.findById() Error:");
            console.log(error);
            return response.redirect("back");
        }
        response.render("comments/edit", { campground_id: request.params.id, comment: foundComment });
    });
});

router.put("/:comment_id", middleware.checkCommentOwnership, (request, response) => {
    Comment.findByIdAndUpdate(request.params.comment_id, request.body.comment, (error, updatedComment) => {
        if (error || !updatedComment) {
            console.log("Comment.findByIdAndUpdate() Error:");
            console.log(error);
            return response.redirect("back");
        }
        request.flash("success", "Successfully edited comment!");
        response.redirect("/campgrounds/" + request.params.id);
    })
});

router.delete("/:comment_id", middleware.checkCommentOwnership, (request, response) => {
    Comment.findByIdAndRemove(request.params.comment_id, (error, removedComment) => {
        if (error || !removedComment) {
            console.log("Comment.findByIdAndRemove() Error:");
            console.log(error);
            return response.redirect("back");
        }
        request.flash("success", "Successfully deleted comment!");
        response.redirect("/campgrounds/" + request.params.id);
    });
});

module.exports = router;