/* ==========================================================================
   LUX site settings: the ONE place to change links and hours.
   Leave a link as '' to keep the current phone-based fallback.
   ========================================================================== */
window.LUX_CONFIG = {
  // Online booking page (Resy, OpenTable, Toast Tables, Tock...).
  // '' = every "Reserve" button leads to "Call to reserve" / dials the restaurant. On phones the dock's
  //      gold button reads "Call to book" and its plain Call button is left out (both would dial the same number).
  // Set = they read "Book online" (the Reserve panel) and open this page; the dock shows Call and Reserve.
  reserveUrl: '',

  // Online ordering page (Toast, ChowNow, Square...).
  // '' = the "Order pickup" links lead to "Call for pickup" / dial the restaurant. On phones the dock's
  //      Order slot opens the food menu instead (the call button already covers pickup).
  // Set = they read "Order online" and open this page, the dock's Order included.
  orderUrl: '',

  // Private-events form endpoint, e.g. 'https://formspree.io/f/xxxxxxx'.
  // '' = the form validates, then hands the guest a pre-filled email to `email`
  // ("Almost there"). Inquiries are only delivered automatically once this is set.
  eventsFormEndpoint: '',

  phone: '(515) 209-9999',
  phoneHref: 'tel:+15152099999',
  email: 'lux@luxwaukee.com',

  // ------------------------------------------------------------------------
  // HOURS: drive the live "Open now" status, the Visit hours table, the footer,
  // the hero hours strip and the menu tab hours. (The JSON-LD block in
  // index.html is the only other copy: keep it in step by hand.)
  //
  //   name:  the service ('Lunch', 'Dinner'...). Services that share a name
  //          share a column in the hours table.
  //   days:  0 = Sunday, 1 = Monday ... 6 = Saturday.
  //   open / close: 24-hour 'HH:MM', local to timeZone. A close earlier than
  //          the open (e.g. '01:00') means after midnight.
  //
  // A closed day is simply a day that no service lists. Example, closed Mondays:
  //   { name: 'Lunch', days: [0, 2, 3, 4, 5, 6], open: '10:30', close: '14:30' }
  //
  // Source: Axios Des Moines, Oct 7 2026. Please confirm with the owner.
  // ------------------------------------------------------------------------
  timeZone: 'America/Chicago',
  services: [
    { name: 'Lunch',  days: [0, 1, 2, 3, 4, 5, 6], open: '10:30', close: '14:30' },
    { name: 'Dinner', days: [0, 1, 2, 3, 4],       open: '16:30', close: '21:30' },
    { name: 'Dinner', days: [5, 6],                open: '16:30', close: '23:00' }
  ],

  // ------------------------------------------------------------------------
  // MENU TAB that opens first.
  //   true  = the service being served, otherwise the next one: the Lunch card
  //           overnight, in the morning and during lunch; the Dinner card from
  //           the end of lunch until closing.
  //   false = always the Dinner card. The "Now serving" badge marks whichever
  //           service is open either way.
  // A link straight to a course (e.g. .../#course-picks, .../#lunch-course-sides)
  // always opens the card that holds it, whatever this is set to.
  // ------------------------------------------------------------------------
  menuTabFollowsService: true
};
