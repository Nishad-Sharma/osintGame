import { Injectable, signal, inject } from '@angular/core';
import { min } from 'rxjs';
import { Firestore, collection, addDoc, getDocs, doc, getDoc } from '@angular/fire/firestore';

@Injectable({
    providedIn: 'root',
})
export class Game {
    // username: string = 'Anon';
    private firestore = inject(Firestore);

    private locationImages: Location[] = [];
    private guesses: Guess[] = [];
    private currImageIndex: number = 0;

    private maxScore = 15;
    private minScore = 1;
    private minScoringDistance = 50; // meters

    currentImage = signal<Location | null>(this.locationImages[0]);
    isGuessSubmitted = signal<boolean>(false);
    isGameOver = signal<boolean>(false);
    isLastImage = signal<boolean>(false);

    constructor() {
        this.loadLocationImages();
    }

    async loadLocationImages() {
        try {
            const collectionRef = collection(this.firestore, 'locationImages');
            const query = await getDocs(collectionRef);

            this.locationImages = query.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    path: data['path']
                } as Location;
            });
            this.currentImage.set(this.locationImages[0]);
            console.log("loaded location imagepaths")
        } catch (error) {
            console.log("error querying location images: ", error);
        }
    }

    // startGame(username: string) {
    //     this.username = username;
        // }

    async submitGuess(latitude: number, longitude: number) {
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            console.log('invalid coordinates');
            return;
        }
        // fetch lat, long from firestore now.
        // todo: should register a guess first before fetching. can users pull lat/long with image id?
        const docRef = doc(this.firestore, 'locationImages', String(this.locationImages[this.currImageIndex].id));
        const query = await getDoc(docRef);

        if (!query.exists()) {
            console.log("error pulling location data to validate guess")
            return;
        }
        console.log("loaded location data for validation")
        this.locationImages[this.currImageIndex].latitude = query.data()['latitude'];
        this.locationImages[this.currImageIndex].longitude = query.data()['longitude'];
        

        let guess: Guess = {id: this.locationImages[this.currImageIndex].id, latitude: latitude, longitude: longitude};
        this.guesses.push(guess);
        let score = this.calculateScore(guess);
        this.guesses[this.guesses.length - 1].score = score;
        this.isGuessSubmitted.set(true);
    }

    calculateScore(guess: Guess): number {
        let distance = this.calculateDistance(guess);
        this.guesses[this.guesses.length - 1].distance = distance;
        if (distance > this.minScoringDistance) {
            return 0;
        }

        let pointsPerMeter = (this.maxScore - this.minScore) / this.minScoringDistance;

        let score = this.minScore + (this.minScoringDistance - distance) * pointsPerMeter;
        let clampedScore = Math.min(this.maxScore, Math.max(this.minScore, score));
        return Math.round(clampedScore * 100) / 100;
    }

    // using haversine formula
    // calcs shortest distance between 2 points on sphere
    // finds angle between points from their coords and multiplies by earth's radius
    // handles large subtractions such as -179 - 179 = (-358) found around points crossing the antimeridian
    // halfs the delta 358/2 = 179, sin(179) = sin(1), would end up with an angle of 2 degrees.
    calculateDistance(guess: Guess): number {
        let location = this.locationImages.find(loc => loc.id === guess.id);
        if (!location || location.latitude === undefined || location.longitude === undefined) {
            console.log('Location not found or invalid lat/long for guess id:', guess.id);
            throw new Error('Location not found');
        }
        let guessLatitudeRads = guess.latitude * (Math.PI / 180);
        let guessLongitudeRads = guess.longitude * (Math.PI / 180);

        let actualLatitudeRads = location.latitude * (Math.PI / 180);
        let actualLongitudeRads = location.longitude * (Math.PI / 180);

        let deltaLatitude = actualLatitudeRads - guessLatitudeRads;
        let deltaLongitude = actualLongitudeRads - guessLongitudeRads;

        let sinDeltaLatitude = Math.sin(deltaLatitude / 2) 
        let sinSquaredDeltaLatitude = sinDeltaLatitude * sinDeltaLatitude;

        let sinDeltaLongitude = Math.sin(deltaLongitude / 2);
        let sinSquaredDeltaLongitude = sinDeltaLongitude * sinDeltaLongitude;

        let a = sinSquaredDeltaLatitude + Math.cos(guessLatitudeRads) * Math.cos(actualLatitudeRads) * sinSquaredDeltaLongitude;
        let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        let earthRadiusM = 6371000;
        let distance = c * earthRadiusM;

        return distance;
    }

    nextImage() {
        this.currImageIndex++;
        if (this.currImageIndex < this.locationImages.length) {
            this.currentImage.set(this.locationImages[this.currImageIndex]);
            this.isGuessSubmitted.set(false);
            const isLast = this.currImageIndex === this.locationImages.length - 1;
            this.isLastImage.set(isLast);

        } else {
            console.log("game complete, logging results")
            this.logGameResult();
            this.isGameOver.set(true);
        }
    }

    resetGame() {
        this.currImageIndex = 0;
        this.guesses = [];
        this.isGuessSubmitted.set(false);
        this.isGameOver.set(false);
        this.currentImage.set(this.locationImages[this.currImageIndex]);
        this.isLastImage.set(false);
    }

    getCurrDistance(): number {
        return this.guesses[this.currImageIndex].distance || 0;
    }

    getCurrScore(): number {
        return this.guesses[this.currImageIndex].score || 0;
    }

    getTotalScore(): number {
        return this.guesses.reduce((acc, val) => acc + (val.score || 0), 0);
    }

    getCurrGuess(): Guess {
        if (this.guesses.length == 0) {
            throw new Error('no guesses yet.');
        }
        return this.guesses[this.currImageIndex];
    }

    getGuesses(): Guess[] {
        return this.guesses;
    }

    getActualLocation(): Location {
        return this.locationImages[this.currImageIndex];
    }

    private async logGameResult() {
        const gameLog: GameLog = {
            timestamp: new Date(),
            totalScore: this.getTotalScore(),
            guesses: this.guesses,
        };

        try {
            // access collection 'gameLogs'
            const collectionRef = collection(this.firestore, 'gameLogs');
            // add document to collection, auto generates id and writes data.
            await addDoc(collectionRef, gameLog);
            console.log('game stats written to firestore');
        } catch (error) {
            console.error('error writing to firestore: ', error);
        }
    }
}

export interface Location {
    id: string;
    path: string;
    latitude?: number;
    longitude?: number;
}

export interface Guess {
    id: string; // make image id
    latitude: number;
    longitude: number;
    score?: number; // use cloud fns so users can't cheat
    distance?: number;
}

export interface GameLog {
    timestamp: Date;
    totalScore: number;
    guesses: Guess[];
}