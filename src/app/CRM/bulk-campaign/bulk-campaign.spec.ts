import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BulkCampaign } from './bulk-campaign';

describe('BulkCampaign', () => {
  let component: BulkCampaign;
  let fixture: ComponentFixture<BulkCampaign>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BulkCampaign],
    }).compileComponents();

    fixture = TestBed.createComponent(BulkCampaign);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
