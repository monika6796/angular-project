import { Component } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { CommonModule } from '@angular/common';
import { ChartOptions, ChartType } from 'chart.js';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './dashboard.component.html',
  styleUrl:'./dashboard.component.css'
})
export class DashboardComponent {

  // ✅ IMPORTANT: proper format
  public lineChartData = {
    labels: ['2026-03-07', '2026-03-09', '2026-03-14'],
    datasets: [
      {
        data: [1, 1, 1],   // 🔥 zero mat rakho test ke liye
        label: 'Number of New Contacts',


        borderColor: '#0d6efd',
        backgroundColor: '#0d6efd',

        pointStyle: 'circle', // 🔥 MUST
        tension: 0,
        fill: false,
        pointRadius: 4,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#4e73df'
      }
    ]
  };

  public lineChartOptions = {
    responsive: true,

    plugins: {
      legend: {
       display: false  
      }
    },

    scales: {
      y: {
        min: 0,          // 🔥 start
        max: 1,          // 🔥 end

        ticks: {
          stepSize: 0.2,
          callback: function (value: any) {
            // 🔥 agar integer hai to decimal hata do
            if (value === 0 || value === 1) {
              return value;
            }
            return value.toFixed(1);
          }
        },

        grid: {
          color: '#e9ecef'
        }
      },

      x: {
        offset: true,

        ticks: {
          padding: 10
        },
        grid: {
          display: false
        }
      }
    }
  };

  public lineChartType: ChartType = 'line';

}