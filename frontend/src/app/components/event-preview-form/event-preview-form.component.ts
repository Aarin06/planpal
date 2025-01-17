import {
  Component,
  Output,
  EventEmitter,
  Input,
  ChangeDetectorRef,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { createEventId } from '../calendar/event-utils';
import { placesSearchResult } from '../../classes/placesSearchResult';
import { ItineraryService } from '../../services/itinerary.service';
import { EventService } from '../../services/event.service';
import { DBEvent } from '../../classes/dbEvent';

@Component({
  selector: 'app-event-preview-form',
  templateUrl: './event-preview-form.component.html',
  styleUrl: './event-preview-form.component.scss',
})
export class EventPreviewFormComponent {
  @Output() openEventPreview = new EventEmitter<boolean>();
  @Input() calendarEventClickArgs: any = null;
  @Input() itineraryId: number | null = null;
  newLocation: google.maps.LatLng = new google.maps.LatLng(0 ,0);

  eventForm: FormGroup;
  initalEventData: DBEvent | null = null;

  constructor(
    private formBuilder: FormBuilder,
    private cdRef: ChangeDetectorRef,
    private eventApi: EventService,
  ) {
    this.eventForm = this.formBuilder.group({
      eventName: ['', Validators.required],
      location: ['', Validators.required],
      // description: ['']
    });
  }
  ngOnInit(): void {
    this.eventApi
      .getEvent(this.calendarEventClickArgs.clickInfo.event.id)
      .subscribe({
        next: (value) => {
          this.newLocation = value.location.location;
          this.eventForm.get('eventName')?.setValue(value.title);
          this.eventForm.get('location')?.setValue(value.location.address);
          this.initalEventData = value;
        }
      });
  }

  onExitForm(): void {
    this.openEventPreview.emit(false);
    this.calendarEventClickArgs.socket.emit(
      'closeFormEvent',
      this.calendarEventClickArgs.clickInfo.event,
    );
  }

  updateEvent(): void {
    const formValues = this.eventForm.value;

    if (this.eventForm.valid && this.itineraryId) {
      const prevEvent = this.calendarEventClickArgs.clickInfo.event;
      if (prevEvent) {
        const newEvent = {
          id: -1,
          title: formValues.eventName,
          extendedProps: {
            location: formValues.location,
          },
        };
        // Step 3: Create Event
        this.eventApi.updateEvent(prevEvent.id, newEvent).subscribe({
          next: (res) => {
            newEvent.id = res.id;
            // prevEvent.event.location = newEvent.extendedProps.location
            prevEvent.setProp('title', newEvent.title);
            prevEvent.setExtendedProp(
              'location',
              newEvent.extendedProps.location,
            );

            let sendEvent = {
              id: newEvent.id,
              title: newEvent.title,
              start: prevEvent.start,
              end: prevEvent.end,
              allDay: prevEvent.allDay,
              extendedProps: newEvent.extendedProps,
            };

            this.calendarEventClickArgs.socket.emit('updateEvent', sendEvent);
          }
        });
        // Step 4: Reset Form (optional)
        this.eventForm.reset();
        // Step 5: Emit Event (if needed, for example, to close the form)
        this.openEventPreview.emit(false);
      }
    } else {
      // Handle form invalid case
    }
  }

  handleDeleteEvent() {
    this.eventApi
      .deleteEvent(this.calendarEventClickArgs.clickInfo.event.id)
      .subscribe({
        next: () => {
          this.calendarEventClickArgs.clickInfo.event.remove();
          this.calendarEventClickArgs.socket.emit(
            'deleteEvent',
            this.calendarEventClickArgs.clickInfo.event,
          );
          this.onExitForm();
        }
      });
  }

  handlePlaceChanged(place: placesSearchResult) {
    this.eventForm.patchValue({
      location: place, // Update the location form control
    });
    if (place.location) {
      this.newLocation = place.location;
      this.cdRef.markForCheck();
    }
  }
}
