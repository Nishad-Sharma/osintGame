import { Component, effect, signal, computed, ViewChild, AfterViewInit, ElementRef, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
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
    styleUrls: ['./guess-screen.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuessScreen implements AfterViewInit, OnDestroy {
    guessForm: FormGroup;
    
    // DESKTOP IMAGE ZOOM/PAN
    zoom = signal(1);
    isPanning = false;
    // image pan position relative to center
    pointX = signal(0);
    pointY = signal(0);
    // drag/pan amount
    startX = 0;
    startY = 0;

    transformStyle = computed(() => 
        `translate(${this.pointX()}px, ${this.pointY()}px) scale(${this.zoom()})`
    );

    // MOBILE IMAGE ZOOM/PAN
    lastTouchDistance = 0;
    lastTouchX = 0;
    lastTouchY = 0;

    @ViewChild('mapContainer') mapContainer!: ElementRef;
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
                this.zoom.set(1);
                this.guessForm.reset();
                this.map?.remove();
                this.map = undefined;
            }
        });
    }

    ngAfterViewInit() {

    }

    ngOnDestroy() {
        if (this.map) {
            this.map.remove();
            this.map = undefined;
        }
    }

    resetView() {
        this.pointX.set(0);
        this.pointY.set(0);
        this.startX = 0;
        this.startY = 0;
    }

    onWheel(event: WheelEvent) {
        event.preventDefault(); // stop webpage scroll to be replaced with image zoom
        const zoomIntensity = 0.1;
        const direction = event.deltaY > 0 ? -1 : 1;
        const newZoom = this.zoom() + (direction * zoomIntensity);
        this.zoom.set(Math.min(Math.max(newZoom, 1), 5));
        // reset pan if default zoom
        if (this.zoom() === 1) { 
            this.pointX.set(0);
            this.pointY.set(0); 
        } 
    }

    onMouseDown(event: MouseEvent) {
        if (this.zoom() > 1) {
            event.preventDefault();
            this.isPanning = true;
            this.startX = event.clientX - this.pointX();
            this.startY = event.clientY - this.pointY();
        }
    }

    onMouseUp() { this.isPanning = false; }

    onMouseMove(event: MouseEvent) {
        if (!this.isPanning) return;
        event.preventDefault();
        this.pointX.set(event.clientX - this.startX);
        this.pointY.set(event.clientY - this.startY);
    }

    // mobile touch events for pan and pinch zoom. one finger pan, two finger pinch zoom.
    onTouchStart(event: TouchEvent) {
        if (event.touches.length === 1 && this.zoom() > 1) {
            this.isPanning = true;
            this.lastTouchX = event.touches[0].clientX;
            this.lastTouchY = event.touches[0].clientY;
        } else if (event.touches.length === 2) {
            this.lastTouchDistance = this.getTouchDistance(event);
        }
    }

    onTouchMove(event: TouchEvent) {
        if (event.touches.length === 1 && this.isPanning) {
            const clientX = event.touches[0].clientX;
            const clientY = event.touches[0].clientY;

            const deltaX = clientX - this.lastTouchX;
            const deltaY = clientY - this.lastTouchY;

            this.pointX.set(this.pointX() + deltaX);
            this.pointY.set(this.pointY() + deltaY);

            this.lastTouchX = clientX;
            this.lastTouchY = clientY;

        } else if (event.touches.length === 2) {
            const currentDistance = this.getTouchDistance(event);
            if (this.lastTouchDistance > 0) {
                const scaleDiff = currentDistance / this.lastTouchDistance;
                
                const newZoom = this.zoom() * scaleDiff; 
                this.zoom.set(Math.min(Math.max(newZoom, 1), 5));
            }
            this.lastTouchDistance = currentDistance;
            
            if (this.zoom() === 1) {
                this.pointX.set(0);
                this.pointY.set(0);
            }
        }
    }

    private getTouchDistance(event: TouchEvent): number {
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        return Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
    }

    onTouchEnd() {
        this.isPanning = false;
        this.lastTouchDistance = 0;
    }

    onSubmit() {
        if (this.guessForm.valid) {
            const { latitude, longitude } = this.guessForm.value;
            this.game.submitGuess(latitude, longitude);
        }
    }

    initMap() {
        if (!this.mapContainer) return;
        if (this.map) this.map.remove();

        const guess = this.game.getCurrGuess();
        const actualLocation = this.game.getActualLocation();
        const distance = this.game.currDistance();
        const score = this.game.currScore();
        if (!guess || !actualLocation || actualLocation.latitude === undefined || actualLocation.longitude === undefined) {
            return;
        }

        this.map = L.map(this.mapContainer.nativeElement);

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

    nextRound() {
        if (this.map) {
            this.map.remove();
            this.map = undefined;
        }
        this.resetView();
        this.guessForm.reset();
        this.game.nextImage();
        if (this.game.isGameOver()) {
            this.router.navigate(['/end']);
        } 
    }

    getGuessFeedbackMessage(): string {
        const distance = this.game.currDistance();
        
        const formattedDistance = distance >= 1000 
            ? (distance / 1000).toFixed(2) + 'km' 
            : distance.toFixed(2) + 'm';

        if (distance <= 50) {
            return `Nice guess! You were ${formattedDistance} away.`;
        }
        return `Bad luck, you were ${formattedDistance} away. Need to get closer to score points!`;
    }

}