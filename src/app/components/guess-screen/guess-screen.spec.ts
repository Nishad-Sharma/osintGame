import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GuessScreen } from './guess-screen';

describe('GuessScreen', () => {
  let component: GuessScreen;
  let fixture: ComponentFixture<GuessScreen>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuessScreen]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GuessScreen);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
