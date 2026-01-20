import { Injectable, signal, computed, inject } from '@angular/core';
import { Firestore, collection, addDoc } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';

@Injectable({
    providedIn: 'root',
})
export class Game {
    // username: string = 'Anon';
    private firestore = inject(Firestore);
    private functions = inject(Functions);

    private locationImages: Location[] = [
        {id: 'hpVOp3AvqnGLtKm6ERm3', path: '/assets/image1.jpg'},
        {id: 'ReIfcR5IrCuojx2auXon', path: '/assets/Image2.jpg'},
        {id: 'cTF2L9FFNVZwTQfzh3Uq', path: '/assets/image3.png'},
    ];
    guesses = signal<Guess[]>([]);
    // derived signal - calced when accessed.
    currScore = computed(() => {
        return this.guesses()[this.currImageIndex]?.score || 0;
    });
    totalScore = computed(() => {
        return this.guesses().reduce((acc, val) => acc + (val.score || 0), 0);
    });
    currDistance = computed(() => {
        return this.guesses()[this.currImageIndex]?.distance || -1;
    });

    private currImageIndex: number = 0;
    private currentGameLogId: string | null = null;

    currentImage = signal<Location | null>(this.locationImages[0]);
    isGuessSubmitted = signal<boolean>(false);
    isGameOver = signal<boolean>(false);
    isLastImage = signal<boolean>(false);

    constructor() { }

    async startGame() {
        this.resetGame();
        this.preloadImage(this.currImageIndex + 1);

        const initGameLog = {
            startTime: new Date(),
            totalScore: 0,
            guesses: []
        };

        try {
            const docRef = await addDoc(collection(this.firestore, 'gameLogs'), initGameLog);
            this.currentGameLogId = docRef.id;
            console.log("initialized game log with id: ", this.currentGameLogId);
        } catch (error) {
            console.log("error initializing game log: ", error);
        }
    }

    async submitGuess(latitude: number, longitude: number) {
        if (!this.currentGameLogId) {
            console.log('no gameLogId, unable to submit guess');
            return;
        }

        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            console.log('invalid coordinates');
            return;
        }

        const currentLocationId = this.locationImages[this.currImageIndex].id;
        try {
            const submitGuessFn = httpsCallable(this.functions, 'submitGuess');
            const result: any = await submitGuessFn({
                gameLogId: this.currentGameLogId,
                locationId: currentLocationId,
                latitude: latitude,
                longitude: longitude
            });

            const response = result.data;
            this.locationImages[this.currImageIndex].latitude = response.actualLatitude;
            this.locationImages[this.currImageIndex].longitude = response.actualLongitude;

            let guess: Guess = {
                id: currentLocationId,
                latitude: latitude,
                longitude: longitude,
                score: response.score,
                distance: response.distance
            };
            this.guesses.update(current => [...current, guess]);
            this.isGuessSubmitted.set(true);

        } catch (error) {
            console.log('error submitting guess via cloud fn: ', error);
        }
    }

    nextImage() {
        this.currImageIndex++;
        if (this.currImageIndex < this.locationImages.length) {
            this.currentImage.set(this.locationImages[this.currImageIndex]);
            this.isGuessSubmitted.set(false);
            this.preloadImage(this.currImageIndex + 1);
            const isLast = this.currImageIndex === this.locationImages.length - 1;
            this.isLastImage.set(isLast);
        } else {
            this.isGameOver.set(true);
        }
    }

    preloadImage(index: number) {
        if (index < this.locationImages.length) {
            const nextImage = new Image();
            nextImage.src = this.locationImages[index].path;
        }
    }

    resetGame() {
        this.currImageIndex = 0;
        this.guesses.set([]);
        this.currentGameLogId = null;
        this.isGuessSubmitted.set(false);
        this.isGameOver.set(false);
        this.currentImage.set(this.locationImages[this.currImageIndex]);
        this.isLastImage.set(false);
    }

    getCurrGuess(): Guess {
        if (this.guesses().length == 0) {
            throw new Error('no guesses yet.');
        }
        return this.guesses()[this.currImageIndex];
    }

    getGuesses(): Guess[] {
        return this.guesses();
    }

    getActualLocation(): Location {
        return this.locationImages[this.currImageIndex];
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
