import { Component, effect, OnInit, ViewChild, AfterViewInit, ElementRef, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Game } from '../../services/game';
import { Router } from '@angular/router';
import * as L from 'leaflet';

@Component({
    selector: 'app-guess-screen',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './guess-screen.html',
    styleUrls: ['./guess-screen.scss']
})
export class GuessScreen {
    guessForm: FormGroup;
    
    // pc zoom/pan
    zoom = 1;
    isPanning = false;
    // image pan position relative to center
    pointX = 0;
    pointY = 0;
    // drag/pan amount
    startX = 0;
    startY = 0;

    private map: L.Map | undefined;

    constructor(
        private fb: FormBuilder,
        public game: Game,
        private router: Router
    ) {
        //reactive form for guess input
        this.guessForm = this.fb.group({
            latitude: ['', [Validators.required, Validators.min(-90), Validators.max(90)]],
            longitude: ['', [Validators.required, Validators.min(-180), Validators.max(180)]]
        });

        effect(() => {
            // init map after guess.
            if (this.game.isGuessSubmitted()) {
                setTimeout(() => this.initMap(), 100);
            }
            
        });

        effect(() => {
            // new image, reset view and input form and removes the map.
            // simple way to check for new turn, not a great solution - unintuitive. 
            // should have a turn counter in game service and check when that is incremented.
            if (this.game.currentImage()) {
                this.resetView();
                this.guessForm.reset();
                this.map?.remove();
                this.map = undefined;
            }
        });
    }

    resetView() {
        this.zoom = 1;
        this.pointX = 0;
        this.pointY = 0;
        this.startX = 0;
        this.startY = 0;
    }

    onWheel(event: WheelEvent) {
        event.preventDefault(); // stop webpage scroll to be replaced with image zoom
        const zoomIntensity = 0.1;
        const direction = event.deltaY > 0 ? -1 : 1;
        const newZoom = this.zoom + (direction * zoomIntensity);
        this.zoom = Math.min(Math.max(newZoom, 1), 5);
        // reset pan if default zoom
        if (this.zoom === 1) { 
            this.pointX = 0; 
            this.pointY = 0; 
        } 
    }

    onMouseDown(event: MouseEvent) {
        if (this.zoom > 1) {
            event.preventDefault();
            this.isPanning = true;
            this.startX = event.clientX - this.pointX;
            this.startY = event.clientY - this.pointY;
        }
    }

    onMouseUp() { this.isPanning = false; }

    onMouseMove(event: MouseEvent) {
        if (!this.isPanning) return;
        event.preventDefault();
        this.pointX = event.clientX - this.startX;
        this.pointY = event.clientY - this.startY;
    }
  
    get transformStyle() {
        return `translate(${this.pointX}px, ${this.pointY}px) scale(${this.zoom})`;
    }

    onSubmit() {
        if (this.guessForm.valid) {
            const { latitude, longitude } = this.guessForm.value;
            this.game.submitGuess(latitude, longitude);
        }
    }


    initMap() {
        const guess = this.game.getCurrGuess();
        const actualLocation = this.game.getActualLocation();
        const distance = this.game.getCurrDistance();
        const score = this.game.getCurrScore();
        if (!guess || !actualLocation || actualLocation.latitude === undefined || actualLocation.longitude === undefined) {
            return;
        }

        this.map = L.map('result-map');

        // provides map tile names in local lang. find diff tile servers that are english or allow choosing a lang.
        // L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        //     attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        // }).addTo(this.map);

        // english tile server
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
        }).addTo(this.map);
        
        
        let greenPin = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            tooltipAnchor: [0, -45]
        });

        let redPin = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            tooltipAnchor: [0, -45]
        });

        L.marker([guess.latitude, guess.longitude], { icon: redPin })
            .addTo(this.map)
            .bindTooltip(
                "Your Guess", { 
                permanent: true, 
                direction: 'top', 
            });
        
        
        L.marker([actualLocation.latitude, actualLocation.longitude], { icon: greenPin })
            .addTo(this.map)
            .bindTooltip(
                "Actual Location", { 
                permanent: true, 
                direction: 'top', 
            });

        const points: [number, number][] = [
            [guess.latitude, guess.longitude],
            [actualLocation.latitude, actualLocation.longitude]
        ];
        
        const distanceFormatted = distance >= 1000 ? (distance / 1000).toFixed(2) + ' km' : distance.toFixed(2) + ' m';
        L.polyline(points, { 
            color: 'purple', 
            weight: 3, 
            opacity: 0.7, 
            dashArray: '10, 10' })
            .addTo(this.map)
            .bindTooltip(
                distanceFormatted, {
                direction: 'center',
                permanent: true,
            });
        
        this.map.fitBounds(points, { padding: [50, 50] });
    }

    getCurrDistance(): number {
        return this.game.getCurrDistance();
    }

    getCurrScore(): number {
        return this.game.getCurrScore();
    }

    getTotalScore(): number {
        return this.game.getTotalScore();
    }

    nextRound() {
        this.game.nextImage();
        if (this.game.isGameOver()) {
            this.router.navigate(['/end']);
        } 
    }

    getGuessFeedbackMessage(): string {
        const distance = this.game.getCurrDistance();
        
        const formattedDistance = distance >= 1000 
            ? (distance / 1000).toFixed(2) + 'km' 
            : distance.toFixed(2) + 'm';

        if (distance <= 50) {
            return `Nice guess! You were ${formattedDistance} away.`;
        }
        return `Bad luck, you were ${formattedDistance} away. Need to get closer to score points!`;
    }

}