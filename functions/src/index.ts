import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

functions.setGlobalOptions({ maxInstances: 5 });

admin.initializeApp();

export const submitGuess = functions.https.onCall(async (request: any) => {
    try {
        // change user access to collections
        const db = admin.firestore();
        let guessData = request.data ? request.data : request; // handle gen1 gen2 differences // bring back GuessData in shared lib for index/game.ts

        if (!guessData) {
            throw new functions.https.HttpsError('invalid-argument', 'no data provided');
        }

        if (!guessData.gameLogId || !guessData.locationId) {
            console.log("missing Ids");
            throw new functions.https.HttpsError('invalid-argument', 'missing gameLogId or locationId');
        }

        const locationImageDoc = await db.collection('locationImages').doc(guessData.locationId).get();

        if (!locationImageDoc.exists) {
            console.log("document not found for locationId:", guessData.locationId);
            throw new functions.https.HttpsError('not-found', 'location image not found');
        }

        const actualLocationData = locationImageDoc.data();
        const actualLatitude = actualLocationData?.latitude ?? null;
        const actualLongitude = actualLocationData?.longitude ?? null;

        if (actualLatitude === null || actualLongitude === null) {
            console.log("actual location data is incomplete for locationId:", guessData.locationId);
            throw new functions.https.HttpsError('data-loss', 'actual location data is incomplete');
        }

        const distance = calculateDistance(
            actualLatitude,
            actualLongitude,
            guessData.latitude,
            guessData.longitude
        );
        const score = calculateScore(distance);

        const lat = Number(guessData.latitude);
        const long = Number(guessData.longitude);

        const guessEntry = {
            locationId: guessData.locationId,
            latitude: lat,
            longitude: long,
            submissionTime: admin.firestore.Timestamp.now()
        };

        await db.collection('gameLogs').doc(guessData.gameLogId).update({
            guesses: admin.firestore.FieldValue.arrayUnion(guessEntry),
            totalScore: admin.firestore.FieldValue.increment(score),
            lastUpdated: admin.firestore.Timestamp.now()
        });

        return { 
            actualLatitude: actualLatitude, actualLongitude: actualLongitude, score: score, distance: distance
        };

    } catch (error) {
        console.error("Error in submitGuess:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'An internal error occurred during guess submission.', error);
    }
});

const minScoringDistance = 50;
const maxScore = 15;
const minScore = 1;
const earthRadiusM = 6371000;

// // TODO: these two functions should be extracted to common lib.
function calculateScore(distance: number): number {
    if (distance > minScoringDistance) {
        return 0;
    }
    let pointsPerMeter = (maxScore - minScore) / minScoringDistance;
    let score = minScore + (minScoringDistance - distance) * pointsPerMeter;
    let clampedScore = Math.min(maxScore, Math.max(minScore, score));
    return Math.round(clampedScore * 100) / 100;
}

// using haversine formula
// calcs shortest distance between 2 points on sphere
// finds angle between points from their coords and multiplies by earth's radius
// handles large subtractions such as -179 - 179 = (-358) found around points crossing the antimeridian
// halfs the delta 358/2 = 179, sin(179) = sin(1), would end up with an angle of 2 degrees.
function calculateDistance(actualLatitude: number, actualLongitude: number, guessLatitude: number, guessLongitude: number): number {
    let guessLatitudeRads = guessLatitude * (Math.PI / 180);
    let guessLongitudeRads = guessLongitude * (Math.PI / 180);
    let actualLatitudeRads = actualLatitude * (Math.PI / 180);
    let actualLongitudeRads = actualLongitude * (Math.PI / 180);

    let deltaLatitude = actualLatitudeRads - guessLatitudeRads;
    let deltaLongitude = actualLongitudeRads - guessLongitudeRads;

    let sinDeltaLatitude = Math.sin(deltaLatitude / 2) 
    let sinSquaredDeltaLatitude = sinDeltaLatitude * sinDeltaLatitude;
    let sinDeltaLongitude = Math.sin(deltaLongitude / 2);
    let sinSquaredDeltaLongitude = sinDeltaLongitude * sinDeltaLongitude;

    let a = sinSquaredDeltaLatitude + Math.cos(guessLatitudeRads) * Math.cos(actualLatitudeRads) * sinSquaredDeltaLongitude;
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    let distance = c * earthRadiusM;

    return distance;
}