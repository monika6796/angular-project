import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Businessdata } from './businessdata';

describe('Businessdata', () => {
  let component: Businessdata;
  let fixture: ComponentFixture<Businessdata>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Businessdata],
    }).compileComponents();

    fixture = TestBed.createComponent(Businessdata);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
