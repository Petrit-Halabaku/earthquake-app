import { Injectable } from '@angular/core';
import { format, formatDistance, formatRelative } from 'date-fns';

@Injectable({
  providedIn: 'root'
})
export class DateFormatterService {
  constructor() {}

  formatDate(timestamp: number, formatString: string = 'MMM dd, yyyy'): string {
    return format(new Date(timestamp), formatString);
  }

  formatDateTime(timestamp: number): string {
    return format(new Date(timestamp), 'MMM dd, yyyy HH:mm:ss');
  }

  formatTimeAgo(timestamp: number): string {
    return formatDistance(new Date(timestamp), new Date(), { addSuffix: true });
  }

  formatRelative(timestamp: number): string {
    return formatRelative(new Date(timestamp), new Date());
  }
}