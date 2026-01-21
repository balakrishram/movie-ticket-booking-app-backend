import axios from "axios"
import Movie from "../models/Movie.js";
import Show from "../models/Show.js"

const TMDB_TIMEOUT = 15000; // 15 seconds timeout
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second initial delay

const axiosConfig = {
  headers: { Authorization: `Bearer ${process.env.TMDB_API_KEY}` },
  timeout: TMDB_TIMEOUT
};

// Retry wrapper for API calls
const fetchWithRetry = async (url, retries = MAX_RETRIES) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await axios.get(url, axiosConfig);
    } catch (error) {
      if (i === retries - 1) throw error; // Last attempt, throw error
      const delay = RETRY_DELAY * Math.pow(2, i); // Exponential backoff
      console.log(`Retry attempt ${i + 1} after ${delay}ms for URL: ${url}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// API to Get Now Playing Movies from TMDB API
export const getNowPlayingMovies = async (req, res) => {
  try {
    const { data } = await fetchWithRetry('https://api.themoviedb.org/3/movie/now_playing')

    const movies = data.results;
    res.json({ success: true, movies: movies })
  } catch (error) {
    console.log("getNowPlayingMovies Error:", error.message);
    res.json({ success: false, message: error.message })
  }
}

// API to Add New Show to the Database
export const addShow = async (req, res) => {
  try {
    const { movieId, showsInput, showPrice } = req.body;

    let movie = await Movie.findById(movieId)

    if (!movie) {
      try {
        // Fetch movie details and credits from TMDB API with retry logic
        const [movieDetailsResponse, movieCreditsResponse] = await Promise.all([
          fetchWithRetry(`https://api.themoviedb.org/3/movie/${movieId}`),
          fetchWithRetry(`https://api.themoviedb.org/3/movie/${movieId}/credits`)
        ]);

        const movieApiData = movieDetailsResponse.data;
        const movieCreditsData = movieCreditsResponse.data;

        const movieDetails = {
          _id: movieId,
          title: movieApiData.title,
          overview: movieApiData.overview,
          poster_path: movieApiData.poster_path,
          backdrop_path: movieApiData.backdrop_path,
          genres: movieApiData.genres,
          casts: movieApiData.casts,
          release_date: movieApiData.release_date,
          original_language: movieApiData.original_language,
          tagline: movieApiData.tagline || "",
          vote_average: movieApiData.vote_average,
          runtime: movieApiData.runtime
        }

        // Add movie to the database
        movie = await Movie.create(movieDetails);
      } catch (apiError) {
        console.log("TMDB API Error:", apiError.message);
        return res.json({ success: false, message: `Failed to fetch movie from TMDB: ${apiError.message}` })
      }
    }

    const showsToCreate = [];
    showsInput.forEach(show => {
      const showDate = show.date;
      show.time.forEach(time => {
        const dateTimeString = `${showDate}T${time}`;
        showsToCreate.push({
          movie: movieId,
          showDateTime: new Date(dateTimeString),
          showPrice,
          occupiedSeats: {}
        })
      });
    });

    if (showsToCreate.length > 0) {
      await Show.insertMany(showsToCreate);
    }

    res.json({ success: true, message: 'Show Added successfully.' })

  } catch (error) {
    console.log("addShow Error:", error.message);
    res.json({ success: false, message: error.message })
  }
}

// API to Get All Shows from the Database
export const getShows = async (req, res) => {
  try {
    const shows = await Show.find({ showDateTime: { $gte: new Date() } }).populate('movie').sort({ showDateTime: 1 });

    //filter unique shows
    const uniqueShows = new Set(shows.map(show => show.movie));
    res.json({ success: true, shows: Array.from(uniqueShows) })
  }
  catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message })
  }
}


// API to Get Single Shows from the Database
export const getShow = async (req, res) => {
  try {
    const { movieId } = req.params;
    // get all upcoming shows for the movie
    const shows = await Show.find({ movie: movieId,showDateTime: { $gte: new Date() } })
    
    const movie = await Movie.findById(movieId);
    const dateTime = {};
    
    shows.forEach((show) => {
      const date = show.showDateTime.toISOString().split("T")[0];
      if(!dateTime[date]){
        dateTime[date] = [];
      }
      dateTime[date].push({ time: show.showDateTime, showId: show._id })
    })
    res.json({success:true,movie,dateTime})
  }
  catch (error) {
    console.log(error);
    res.json({ success: false, message: error.message })
  }
}

