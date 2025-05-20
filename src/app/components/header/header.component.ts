import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: "app-header",
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="header">
      <div class="container">
        <div class="header-content">
          <div class="logo">
            <span class="material-symbols-outlined logo-icon">public</span>
            <h1>SeismoTrack</h1>
          </div>
          <div class="subtitle">Real-time Earthquake Dashboard</div>
        </div>
      </div>
    </header>
  `,
  styles: [
    `
      .header {
        background-color: var(--primary);
        color: white;
        padding: calc(var(--spacing-unit) * 2) 0;
        box-shadow: var(--shadow-md);
      }

      .header-content {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
      }

      .logo {
        display: flex;
        align-items: center;
        gap: calc(var(--spacing-unit) * 1.5);
      }

      .logo-icon {
        font-size: 2.5rem;
        animation: pulse 3s infinite ease-in-out;
      }

      h1 {
        margin: 0;
        font-weight: 700;
        letter-spacing: 0.5px;
      }

      .subtitle {
        font-size: 1rem;
        opacity: 0.9;
        margin-top: calc(var(--spacing-unit) * 0.5);
        font-weight: 300;
      }

      @keyframes pulse {
        0% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.05);
        }
        100% {
          transform: scale(1);
        }
      }

      @media (max-width: 768px) {
        .logo-icon {
          font-size: 2rem;
        }

        h1 {
          font-size: 1.5rem;
        }
      }
    `,
  ],
})
export class HeaderComponent {}