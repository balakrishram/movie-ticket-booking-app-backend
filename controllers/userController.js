import { clerkClient } from "@clerk/express";
import e from "express";
import { use } from "react";


//API to get user bookings
export const getUserBookings = async (req, res) => {
    try {
        const user = req.auth().userId;
        const bookings = await Booking.find({ user }).populate({
            path: "show",
            populate: {path: "movie"}
        }).sort({ createdAt: -1 });
        res.json({ success: true, bookings });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

//API to update favorite movie in cler user metadata
export const updateFavorite = async (req, res) => {
    try {
        const userId = req.auth().userId;
        const { movieId } = req.body;
        const user = await clerkClient.users.getUser(userId);
        if (!user.privateMetadata.favorites) {
            user.privateMetadata.favorites = [];
        }
        if (!user.privateMetadata.favorites.includes(movieId)) {
            user.privateMetadata.favorites.push(movieId);
        }else{
            user.privateMetadata.favorites = user.privateMetadata.favorites.filter(id => id !== movieId);
        }
        await clerkClient.users.updateUserMetadata(userId, { privateMetadata: user.privateMetadata});
        res.json({ success: true, message: "Favorite updated successfully" });
    }
    catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }
}

export const getFavoriteMovies = async (req, res) => {
    try {
        const userId = req.auth().userId;
        const user = await clerkClient.users.getUser(userId);
        const favorites = user.privateMetadata.favorites;

        //getting movies from database
        const movies = await Movie.find({ _id: { $in: favorites } });

        res.json({ success: true, movies });
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message })
    }}