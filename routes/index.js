const express = require("express");
const router = express.Router();
const passport = require("passport");
const async = require("async");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const User = require("../models/user");
const Campground = require("../models/campground");

router.get("/", (request, response) => {
    response.render("landing");
});

router.get("/register", (request, response) => {
    response.render("register", { page: "register" });
});

router.post("/register", (request, response) => {
    const newUser = new User({
        username: request.body.username,
        firstName: request.body.firstName,
        lastName: request.body.lastName,
        phoneNumber: request.body.phoneNumber,
        email: request.body.email
    });
    if (request.body.adminCode === process.env.YC_ADMIN) {
        newUser.isAdmin = true;
    }
    User.register(newUser, request.body.password, (error, user) => {
        if (error || !user) {
            request.flash("error", error.message + "!");
            return response.redirect("/register");
        }
        passport.authenticate("local")(request, response, () => {
            request.flash("success", "Welcome to YelpCamp, " + user.username + "!");
            response.redirect("/campgrounds");
        })
    });
});

router.get("/login", (request, response) => {
    response.render("login", { page: "login" });
});

router.post("/login", passport.authenticate("local",
    {
        successRedirect: "/campgrounds",
        failureRedirect: "/login"
    }), (request, response) => {
});

router.get("/logout", (request, response) => {
    request.logout();
    request.flash("success", "Successfully logged you out!");
    response.redirect("/campgrounds");
});

router.get("/forgot", (request, response) => {
    response.render("forgot");
});

router.post("/forgot", (request, response, next) => {
    async.waterfall([
        (done) => {
            crypto.randomBytes(20, (error, buffer) => {
                const token = buffer.toString("hex");
                done(error, token);
            });
        },
        (token, done) => {
            User.findOne({ email: request.body.email }, (error, user) => {
                if (!user) {
                    request.flash("error", "No account with that email address exists.");
                    return response.redirect("/forgot");
                }
                user.resetPasswordToken = token;
                user.resetPasswordExpires = Date.now() + 3600000;
                user.save((error) => {
                    done(error, token, user);
                });
            });
        },
        (token, user, done) => {
            const smtpTransport = nodemailer.createTransport({
                auth: {
                    user: process.env.GMAIL_USER,
                    pass: process.env.GMAILPW
                },
                service: "Gmail"
            });
            const mailOptions = {
                to: user.email,
                from: process.env.GMAIL_USER,
                subject: "YelpCamp Password Reset",
                text: "You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n" +
                    "Please click on the following link, or paste this into your browser to complete the process:\n\n" +
                    "http://" + request.headers.host + "/reset/" + token + "\n\n" +
                    "If you did not request this, please ignore this email and your password will remain unchanged.\n"
            };
            smtpTransport.sendMail(mailOptions, (error) => {
                request.flash("success", "An e-mail has been sent to " + user.email + " with further instructions.");
                done(error, "done");
            });
        }
    ], (error) => {
        if (error) {
            return next(error);
        }
        response.redirect("/forgot");
    });
});

router.get("/reset/:token", (request, response) => {
    User.findOne({
        resetPasswordToken: request.params.token,
        resetPasswordExpires: { $gt: Date.now() }
    }, (error, user) => {
        if (!user) {
            request.flash("error", "Password reset token is invalid or has expired.");
            return response.redirect("/forgot");
        }
        response.render("reset", { token: request.params.token });
    });
});

router.post("/reset/:token", (request, response) => {
    async.waterfall([
        (done) => {
            User.findOne({
                resetPasswordToken: request.params.token,
                resetPasswordExpires: { $gt: Date.now() }
            }, (error, user) => {
                if (!user) {
                    request.flash("error", "Password reset token is invalid or has expired.");
                    return response.redirect("back");
                }
                if (request.body.password === request.body.confirm) {
                    user.setPassword(request.body.password, (error) => {
                        user.resetPasswordToken = undefined;
                        user.resetPasswordExpires = undefined;
                        user.save((error) => {
                            request.logIn(user, (error) => {
                                done(error, user);
                            });
                        });
                    })
                } else {
                    request.flash("error", "Passwords do not match.");
                    return response.redirect("back");
                }
            });
        },
        (user, done) => {
            const smtpTransport = nodemailer.createTransport({
                auth: {
                    user: process.env.GMAIL_USER,
                    pass: process.env.GMAILPW
                },
                service: "Gmail"
            });
            const mailOptions = {
                to: user.email,
                from: process.env.GMAIL_USER,
                subject: "Your YelpCamp password has been changed.",
                text: "This is a confirmation that the password for your account " + user.email + " has just been changed.\n"
            };
            smtpTransport.sendMail(mailOptions, (error) => {
                request.flash("success", "Success! Your password has been changed.");
                done(error);
            });
        }
    ], (error) => {
        response.redirect("/campgrounds");
    });
});

router.get("/users/:id", (request, response) => {
    User.findById(request.params.id, (error, foundUser) => {
        if (error || !foundUser) {
            console.log("User.findById() Error:");
            console.log(error);
            return response.redirect("back");
        }
        Campground.find().where("author.id").equals(foundUser._id).exec((error, campgrounds) => {
            if (error || !campgrounds) {
                console.log("Campground.find() Error:");
                console.log(error);
                return response.redirect("back");
            }
            response.render("users/show", { user: foundUser, campgrounds: campgrounds });
        });
    });
});

module.exports = router;