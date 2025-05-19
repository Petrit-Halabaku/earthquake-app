import {
  Component,
  type OnInit,
  Output,
  EventEmitter,
  type OnDestroy,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormsModule,
  ReactiveFormsModule,
  type FormGroup,
  FormBuilder,
  Validators,
  type AbstractControl,
} from "@angular/forms";
import { ToastrService } from "ngx-toastr";
import type { EarthquakeFilters } from "../../models/earthquake.model";
import { format, subDays, isAfter, parseISO, differenceInDays } from "date-fns";
import { Subject } from "rxjs";
import { debounceTime, takeUntil } from "rxjs/operators";
import { EarthquakeService } from "../../services/earthquake.service";

/**
 * Component for filtering earthquake data
 * Allows users to set date ranges, magnitude ranges, and geographic coordinates
 */
@Component({
  selector: "app-filter",
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="card filter-card">
      <h3 class="card-title">Filter Earthquakes</h3>
      <form [formGroup]="filterForm" (ngSubmit)="applyFilters()">
        <div class="grid">
          <div class="form-group" style="grid-column: span 6;">
            <label for="startTime" class="form-label">Start Date</label>
            <input
              type="date"
              id="startTime"
              class="form-control"
              formControlName="startTime"
            />
            <div *ngIf="isFieldInvalid('startTime')" class="form-error">
              {{ getErrorMessage("startTime") }}
            </div>
          </div>
          <div class="form-group" style="grid-column: span 6;">
            <label for="endTime" class="form-label">End Date</label>
            <input
              type="date"
              id="endTime"
              class="form-control"
              formControlName="endTime"
            />
            <div *ngIf="isFieldInvalid('endTime')" class="form-error">
              {{ getErrorMessage("endTime") }}
            </div>
            <div *ngIf="dateRangeWarning" class="form-warning">
              {{ dateRangeWarning }}
            </div>
          </div>
          <div class="form-group" style="grid-column: span 6;">
            <label for="minMagnitude" class="form-label">Min Magnitude</label>
            <input
              type="number"
              id="minMagnitude"
              class="form-control"
              formControlName="minMagnitude"
              min="0"
              step="0.1"
            />
            <div *ngIf="isFieldInvalid('minMagnitude')" class="form-error">
              {{ getErrorMessage("minMagnitude") }}
            </div>
          </div>
          <div class="form-group" style="grid-column: span 6;">
            <label for="maxMagnitude" class="form-label">Max Magnitude</label>
            <input
              type="number"
              id="maxMagnitude"
              class="form-control"
              formControlName="maxMagnitude"
              min="0"
              step="0.1"
            />
            <div *ngIf="isFieldInvalid('maxMagnitude')" class="form-error">
              {{ getErrorMessage("maxMagnitude") }}
            </div>
          </div>
        </div>

        <details class="advanced-filters mt-2 mb-2">
          <summary>Advanced Filters</summary>
          <div class="grid mt-2">
            <div class="form-group" style="grid-column: span 6;">
              <label for="minLatitude" class="form-label">Min Latitude</label>
              <input
                type="number"
                id="minLatitude"
                class="form-control"
                formControlName="minLatitude"
                min="-90"
                max="90"
                step="0.1"
              />
              <div *ngIf="isFieldInvalid('minLatitude')" class="form-error">
                {{ getErrorMessage("minLatitude") }}
              </div>
            </div>
            <div class="form-group" style="grid-column: span 6;">
              <label for="maxLatitude" class="form-label">Max Latitude</label>
              <input
                type="number"
                id="maxLatitude"
                class="form-control"
                formControlName="maxLatitude"
                min="-90"
                max="90"
                step="0.1"
              />
              <div *ngIf="isFieldInvalid('maxLatitude')" class="form-error">
                {{ getErrorMessage("maxLatitude") }}
              </div>
            </div>
            <div class="form-group" style="grid-column: span 6;">
              <label for="minLongitude" class="form-label">Min Longitude</label>
              <input
                type="number"
                id="minLongitude"
                class="form-control"
                formControlName="minLongitude"
                min="-180"
                max="180"
                step="0.1"
              />
              <div *ngIf="isFieldInvalid('minLongitude')" class="form-error">
                {{ getErrorMessage("minLongitude") }}
              </div>
            </div>
            <div class="form-group" style="grid-column: span 6;">
              <label for="maxLongitude" class="form-label">Max Longitude</label>
              <input
                type="number"
                id="maxLongitude"
                class="form-control"
                formControlName="maxLongitude"
                min="-180"
                max="180"
                step="0.1"
              />
              <div *ngIf="isFieldInvalid('maxLongitude')" class="form-error">
                {{ getErrorMessage("maxLongitude") }}
              </div>
            </div>
            <div class="form-group" style="grid-column: span 6;">
              <label for="limit" class="form-label">Results Limit</label>
              <input
                type="number"
                id="limit"
                class="form-control"
                formControlName="limit"
                min="1"
                max="500"
              />
              <div *ngIf="isFieldInvalid('limit')" class="form-error">
                {{ getErrorMessage("limit") }}
              </div>
            </div>
          </div>
        </details>

        <div class="form-actions">
          <button
            type="submit"
            class="btn btn-primary"
            [disabled]="filterForm.invalid || isSubmitting"
          >
            <span class="material-symbols-outlined mr-1">filter_alt</span>
            {{ isSubmitting ? "Applying..." : "Apply Filters" }}
          </button>
          <button
            type="button"
            class="btn btn-outline ml-2"
            (click)="resetFilters()"
          >
            <span class="material-symbols-outlined mr-1">restart_alt</span>
            Reset
          </button>
          <button
            type="button"
            class="btn btn-danger ml-2"
            *ngIf="isSubmitting"
            (click)="cancelRequest()"
          >
            <span class="material-symbols-outlined mr-1">cancel</span>
            Cancel
          </button>
        </div>
      </form>

      <div *ngIf="isSubmitting" class="progress-container mt-3">
        <div class="progress-bar" [style.width.%]="progress"></div>
        <div class="progress-text">{{ progress }}% complete</div>
      </div>
    </div>
  `,
  styles: [
    `
      .filter-card {
        margin-bottom: calc(var(--spacing-unit) * 2);
      }

      .form-actions {
        display: flex;
        justify-content: flex-start;
        margin-top: calc(var(--spacing-unit) * 2);
      }

      .advanced-filters {
        border: 1px solid var(--gray-300);
        border-radius: var(--radius-sm);
        padding: var(--spacing-unit);
      }

      .advanced-filters summary {
        cursor: pointer;
        font-weight: 500;
        color: var(--primary);
      }

      .advanced-filters summary:hover {
        color: var(--primary-dark);
      }

      .form-error {
        color: var(--danger);
        font-size: 0.875rem;
        margin-top: 4px;
      }

      .form-warning {
        color: var(--secondary-dark);
        font-size: 0.875rem;
        margin-top: 4px;
      }

      .form-control.ng-invalid.ng-touched {
        border-color: var(--danger);
      }

      .progress-container {
        height: 20px;
        background-color: var(--gray-200);
        border-radius: var(--radius-sm);
        position: relative;
        overflow: hidden;
      }

      .progress-bar {
        height: 100%;
        background-color: var(--primary);
        transition: width 0.3s ease;
      }

      .progress-text {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 0.75rem;
        font-weight: 500;
        text-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
      }

      .btn-danger {
        background-color: var(--danger);
        color: white;
      }

      .btn-danger:hover {
        background-color: #d32f2f;
      }

      @media (max-width: 768px) {
        .form-actions {
          flex-direction: column;
        }

        .form-actions .btn {
          width: 100%;
          margin-bottom: var(--spacing-unit);
          margin-left: 0 !important;
        }
      }
    `,
  ],
})
export class FilterComponent implements OnInit, OnDestroy {
  @Output() filtersChanged = new EventEmitter<EarthquakeFilters>();

  filterForm!: FormGroup;
  isSubmitting = false;
  progress = 0;
  dateRangeWarning: string | null = null;
  private destroy$ = new Subject<void>();
  private formChanges$ = new Subject<void>();
  private readonly MAX_SAFE_DATE_RANGE = 1095; // 1095 days (3 years) max for good performance

  constructor(
    private fb: FormBuilder,
    private toastr: ToastrService,
    private earthquakeService: EarthquakeService
  ) {}

  /**
   * Initializes the component and sets up the filter form
   */
  ngOnInit(): void {
    const today = new Date();
    const thirtyDaysAgo = subDays(today, 30);

    this.filterForm = this.fb.group(
      {
        startTime: [format(thirtyDaysAgo, "yyyy-MM-dd"), [Validators.required]],
        endTime: [format(today, "yyyy-MM-dd"), [Validators.required]],
        minMagnitude: [3.0, [Validators.required, Validators.min(0)]],
        maxMagnitude: [null, [Validators.min(0)]],
        minLatitude: [null, [Validators.min(-90), Validators.max(90)]],
        maxLatitude: [null, [Validators.min(-90), Validators.max(90)]],
        minLongitude: [null, [Validators.min(-180), Validators.max(180)]],
        maxLongitude: [null, [Validators.min(-180), Validators.max(180)]],
        limit: [
          100,
          [Validators.required, Validators.min(1), Validators.max(500)],
        ],
      },
      { validators: this.dateRangeValidator }
    );

    // Subscribe to form changes with debounce
    this.filterForm.valueChanges
      .pipe(takeUntil(this.destroy$), debounceTime(300))
      .subscribe(() => {
        this.checkDateRange();
      });

    // Subscribe to progress updates
    this.earthquakeService.progress$
      .pipe(takeUntil(this.destroy$))
      .subscribe((progress) => {
        this.progress = progress;
      });

    // Apply initial filters
    this.applyFilters();
  }

  /**
   * Cleanup subscriptions on component destroy
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.formChanges$.complete();
  }

  /**
   * Validates that the start date is before the end date
   * @param control - The form control to validate
   * @returns Validation error or null if valid
   */
  dateRangeValidator(
    control: AbstractControl
  ): { [key: string]: boolean } | null {
    const startTime = control.get("startTime")?.value;
    const endTime = control.get("endTime")?.value;

    if (startTime && endTime) {
      const startDate = parseISO(startTime);
      const endDate = parseISO(endTime);

      if (isAfter(startDate, endDate)) {
        return { dateRangeInvalid: true };
      }
    }

    return null;
  }

  /**
   * Checks if the date range is too large and sets a warning
   */
  checkDateRange(): void {
    const startTime = this.filterForm.get("startTime")?.value;
    const endTime = this.filterForm.get("endTime")?.value;

    if (startTime && endTime) {
      const startDate = parseISO(startTime);
      const endDate = parseISO(endTime);
      const daysDiff = differenceInDays(endDate, startDate);

      if (daysDiff > this.MAX_SAFE_DATE_RANGE) {
        this.dateRangeWarning = `Date range is ${daysDiff} days. Large date ranges may cause slow performance.`;
      } else {
        this.dateRangeWarning = null;
      }
    }
  }

  /**
   * Checks if a form field is invalid and should show an error
   * @param fieldName - The name of the field to check
   * @returns True if the field is invalid and touched/dirty
   */
  isFieldInvalid(fieldName: string): boolean {
    const field = this.filterForm.get(fieldName);
    return field ? field.invalid && (field.dirty || field.touched) : false;
  }

  /**
   * Gets the appropriate error message for a field
   * @param fieldName - The name of the field
   * @returns Error message string
   */
  getErrorMessage(fieldName: string): string {
    const field = this.filterForm.get(fieldName);

    if (!field || !field.errors) return "";

    if (field.errors["required"]) return "This field is required";
    if (field.errors["min"])
      return `Value must be at least ${field.errors["min"].min}`;
    if (field.errors["max"])
      return `Value must be at most ${field.errors["max"].max}`;

    if (
      this.filterForm.errors?.["dateRangeInvalid"] &&
      (fieldName === "startTime" || fieldName === "endTime")
    ) {
      return "Start date must be before end date";
    }

    return "Invalid value";
  }

  /**
   * Applies the current filters and fetches earthquake data
   */
  applyFilters(): void {
    if (this.filterForm.valid) {
      this.isSubmitting = true;
      const formValues = this.filterForm.value;

      // Check if min/max magnitude are valid
      if (
        formValues.maxMagnitude !== null &&
        formValues.minMagnitude > formValues.maxMagnitude
      ) {
        this.toastr.error(
          "Minimum magnitude must be less than maximum magnitude"
        );
        this.isSubmitting = false;
        return;
      }

      // Check if coordinates are properly paired
      const hasMinLat = formValues.minLatitude !== null;
      const hasMaxLat = formValues.maxLatitude !== null;
      const hasMinLong = formValues.minLongitude !== null;
      const hasMaxLong = formValues.maxLongitude !== null;

      const hasPartialCoords =
        (hasMinLat || hasMaxLat || hasMinLong || hasMaxLong) &&
        !(hasMinLat && hasMaxLat && hasMinLong && hasMaxLong);

      if (hasPartialCoords) {
        this.toastr.warning(
          "For geographic filtering, all coordinate fields (min/max latitude and longitude) must be provided"
        );
      }

      const filters: EarthquakeFilters = {
        startTime: formValues.startTime,
        endTime: formValues.endTime,
        minMagnitude: formValues.minMagnitude,
        maxMagnitude: formValues.maxMagnitude,
        minLatitude: formValues.minLatitude,
        maxLatitude: formValues.maxLatitude,
        minLongitude: formValues.minLongitude,
        maxLongitude: formValues.maxLongitude,
        limit: formValues.limit,
        offset: 0,
      };

      this.filtersChanged.emit(filters);

      // The isSubmitting state will be updated when the request completes
      this.earthquakeService.loading$
        .pipe(takeUntil(this.destroy$))
        .subscribe((loading) => {
          this.isSubmitting = loading;
        });
    } else {
      this.markFormGroupTouched(this.filterForm);
      this.toastr.error("Please correct the errors in the form");
    }
  }

  /**
   * Resets the filters to default values
   */
  resetFilters(): void {
    const today = new Date();
    const thirtyDaysAgo = subDays(today, 30);

    this.filterForm.reset({
      startTime: format(thirtyDaysAgo, "yyyy-MM-dd"),
      endTime: format(today, "yyyy-MM-dd"),
      minMagnitude: 3.0,
      maxMagnitude: null,
      minLatitude: null,
      maxLatitude: null,
      minLongitude: null,
      maxLongitude: null,
      limit: 100,
    });

    this.dateRangeWarning = null;
    this.applyFilters();
    this.toastr.info("Filters have been reset to default values");
  }

  /**
   * Cancels the current data request
   */
  cancelRequest(): void {
    this.earthquakeService.cancelCurrentRequest();
    this.isSubmitting = false;
    this.toastr.info("Request cancelled");
  }

  /**
   * Helper method to mark all form controls as touched
   * to trigger validation UI
   * @param formGroup - The form group to process
   */
  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();
      if ((control as any).controls) {
        this.markFormGroupTouched(control as FormGroup);
      }
    });
  }
}
