# Magic Lane Maps SDK Examples for TypeScript

Explore practical examples using the Magic Lane Maps SDK for TypeScript - including 3D maps, offline navigation, route calculation, traffic updates, and POI search. Build advanced location-based web applications with ease.

This repository contains dozens of open-source TypeScript sample apps that demonstrate specific SDK features and real-world use cases. Each example focuses on a single feature or workflow, so developers can quickly clone, explore, and integrate the sample code into their projects.

## Why use Magic Lane Maps SDK for TypeScript

The **Magic Lane TypeScript Maps SDK** enables developers to create feature-rich mapping and navigation web applications with:
- Global coverage and offline map support
- Advanced routing for cars, bikes, trucks, and pedestrians
- Customizable 3D maps and map styles
- Voice-guided turn-by-turn navigation
- Real-time traffic updates and driver behavior analytics

## Examples

Explore the examples to learn the capabilities of the SDK:

* [Address Search](address_search) - Demonstrates address search functionality using the Maps SDK.
* [Areas Alarm](areas_alarm) - Demonstrates alarm service usage with area monitoring during route simulation.
* [Assets Map Style](assets_map_style) - Demonstrates loading and applying map styles from assets folder.
* [Better Route Notification](better_route_notification) - Demonstrates better route detection and notifications during navigation simulation.
* [Calculate Bike Route](calculate_bike_route) - Demonstrates calculating and displaying bike routes on a map.
* [Calculate Route](calculate_route) - Demonstrates calculating and displaying routes on a map.
* [Center Area](center_area) - Demonstrates centering the map camera on a specific geographic area.
* [Center Coordinates](center_coordinates) - Demonstrates centering the map on specific coordinates.
* [Center Traffic](center_traffic) - Demonstrates centering the map camera on traffic along a route.
* [Custom Position Icon](custom_position_icon) - Demonstrates setting a custom icon for the position tracker with live datasource.
* [Display Cursor Street Name](display_cursor_street_name) - Demonstrates displaying street names based on tapped map location.
* [Draw Roadblock](draw_roadblock) - Demonstrates drawing roadblocks on a map with path confirmation.
* [Draw Shapes](draw_shapes) - Demonstrates drawing and centering on polylines, polygons, and points.
* [Driver Behaviour](driver_behaviour) - Demonstrates recording and viewing driver behaviour analysis.
* [External Markers](external_markers) - Demonstrates displaying external markers on the map.
* [External Position Source Navigation](external_position_source_navigation) - Demonstrates navigation simulation using an external position data source.
* [Finger Route](finger_route) - Demonstrates calculating routes using finger/touch movement input.
* [Follow Position](follow_position) - Demonstrates live position tracking with startFollowingPosition.
* [GPX Route](gpx_route) - Demonstrates calculating and displaying routes along a GPX path with navigation.
* [GPX Thumbnail Image](gpx_thumbnail_image) - Demonstrates importing GPX files, displaying paths, and taking screenshots.
* [Hello World](hello_world) - Basic example demonstrating how to display a map.
* [Lane Instructions](lane_instructions) - Demonstrates displaying lane instructions during navigation.
* [Location Wikipedia](location_wikipedia) - Demonstrates searching landmarks and displaying Wikipedia information.
* [Map Compass](map_compass) - Demonstrates displaying a compass on the map.
* [Map Gestures](map_gestures) - Demonstrates registering callbacks for map gestures.
* [Map Perspective](map_perspective) - Demonstrates changing map perspective and tilt angle.
* [Map Selection](map_selection) - Demonstrates saving and removing landmarks from a favorites list.
* [Multi-map Routing](multi_map_routing) - Demonstrates creating multiple map views with routing.
* [Multiview Map](multiview_map) - Demonstrates creating multiple map views.
* [Navigate Route](navigate_route) - Demonstrates calculating routes and starting navigation.
* [Overlapped Maps](overlapped_maps) - Demonstrates displaying two overlapped maps.
* [Projections](projections) - Demonstrates viewing coordinates in multiple coordinate systems.
* [Public Transit](public_transit) - Demonstrates calculating and displaying public transit routes.
* [Public Transit Stop Schedule](public_transit_stop_schedule) - Demonstrates selecting transit stations and displaying trip schedules.
* [Range Finder](range_finder) - Demonstrates displaying route ranges panel with distance information.
* [Route Alarms](route_alarms) - Demonstrates using the alarms service during route simulation.
* [Route Instructions](route_instructions) - Demonstrates displaying turn-by-turn route instructions.
* [Route Profile](route_profile) - Demonstrates displaying route elevation profile and climb details.
* [Search Along Route](search_along_route) - Demonstrates searching for points of interest along a route.
* [Search Category](search_category) - Demonstrates text search with results display and map highlighting.
* [Search Location](search_location) - Demonstrates location search with distance display and map highlighting.
* [Simulate Navigation](simulate_navigation) - Demonstrates simulating navigation along a calculated route.
* [Simulate Navigation Without Map](simulate_navigation_without_map) - Demonstrates route simulation without displaying a map.
* [Speed TTS Warning](speed_tts_warning) - Demonstrates text-to-speech speed warnings and speed limit display.
* [Speed Watcher](speed_watcher) - Demonstrates displaying a speed indicator panel during simulation.
* [Text Search](text_search) - Demonstrates text search with results, distances, and map highlighting.
* [Truck Profile](truck_profile) - Demonstrates calculating routes with truck profile settings.
* [What Is Nearby](what_is_nearby) - Demonstrates searching nearby locations by category using GenericCategories.

## Running individual examples

Individual samples can be run in a web browser using the Vite development server.

```bash
cd hello_world
npm install
npm start
```

Check the `README.md` inside each example folder for specific instructions.

## Configuring API Keys

An API Key is required to unlock the full functionality of these example applications. Follow our [guide](https://developer.magiclane.com/docs/guides/get-started) to generate your API Key.

If no API Key is set, you can still test your apps, but a watermark will be displayed, and all online services including mapping, searching, routing, etc. will slow down after a few minutes.

### Setting up your API Token

1. Copy the token template file:
   ```bash
   cp shared/token.template.ts shared/token.ts
   ```

2. Edit `shared/token.ts` and replace `YOUR_API_TOKEN_HERE` with your actual API token:
   ```typescript
   export const GEMKIT_TOKEN = "your_actual_api_token_here";
   ```

3. The `shared/token.ts` file is gitignored, so your token will never be committed to version control.

**Important:** Always keep your API token secure and never commit it to version control.

## Building and Testing All Examples

This repository includes build and smoke test scripts to verify all examples compile and run correctly.

### Install script dependencies

```bash
cd scripts
npm install
```

### Build all examples

```bash
npm run build-all
```

Options:
- `--only=example1,example2` - Build only specific examples
- `--exclude=example1` - Exclude specific examples
- `--no-cache` - Force fresh npm install (bypass cache)

### Run smoke tests

```bash
npm run smoke-test
npm run smoke-test -- --only=hello_world --visible=5
```

Options (use `--` to pass arguments):
- `--only=example1,example2` - Test only specific examples
- `--exclude=example1` - Exclude specific examples
- `--selector=#custom-container` - Use custom container selector
- `--visible` - Show browser window for 5 seconds per example
- `--visible=10` - Show browser window for 10 seconds per example

### Build and test

```bash
npm run test
```

This runs `build-all` followed by `smoke-test` sequentially.

### Format code

```bash
npm run format        # Format all TypeScript files
npm run format:check  # Check formatting without making changes
```

## Developer Resources

- [TypeScript SDK Documentation](https://developer.magiclane.com/docs/typescript): Detailed guides and API references for the SDK.
- [Magic Lane Developer Portal](https://developer.magiclane.com/api/login): Manage API tokens and create custom styles.
- [Build with AI](https://www.magiclane.com/web/build-with-ai): Accelerate development with AI-powered tools and workflows. Compatible with all AI agents.

## License

```
Copyright (C) 2025-2026 Magic Lane International B.V.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

A copy of the license is available in the repository's `LICENSE` file.

Contact Magic Lane at <info@magiclane.com> for SDK licensing options.
