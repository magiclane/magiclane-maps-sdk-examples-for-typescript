// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import {
  GemKit,
  GemMap,
  PositionService,
  DataSource,
  DriverBehaviour,
  DriverBehaviourAnalysis,
  GemAnimation,
  AnimationType,
} from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage } from '../../shared';

let map: GemMap | null = null;
let driverBehaviour: DriverBehaviour | null = null;
let recordedAnalysis: DriverBehaviourAnalysis | null = null;
let hasLiveDataSource = false;
let isAnalysing = false;

// UI Elements
let recordBtn: HTMLButtonElement;
let stopBtn: HTMLButtonElement;
let followBtn: HTMLButtonElement;
let viewAnalysisBtn: HTMLButtonElement;

function updateUI() {
  recordBtn.style.display = hasLiveDataSource && !isAnalysing ? 'block' : 'none';
  stopBtn.style.display = isAnalysing ? 'block' : 'none';
  viewAnalysisBtn.style.display = recordedAnalysis ? 'block' : 'none';
}

async function onMapCreated(gemMap: GemMap) {
  map = gemMap;
}

async function onFollowPositionButtonPressed() {
  // On web, the SDK handles location permission
  const permission = await PositionService.requestLocationPermission();
  if (!permission) {
    showMessage('Location permission denied.');
    return;
  }

  // Set live data source only once
  if (!hasLiveDataSource) {
    PositionService.instance.setLiveDataSource();
    hasLiveDataSource = true;
  }

  // Optionally, set an animation
  const animation = new GemAnimation({ type: AnimationType.linear });

  // Start following position
  map?.startFollowingPosition({ animation });
  updateUI();
}

function onRecordButtonPressed() {
  // Create a live data source
  const liveDataSource = DataSource.createLiveDataSource();
  if (!liveDataSource) {
    showMessage('Creating a data source failed.', 5000);
    return;
  }

  // Create a DriverBehaviour instance with live data source specifications
  driverBehaviour = new DriverBehaviour(liveDataSource, true);

  isAnalysing = true;
  updateUI();

  // Start recording analysis of driver behaviour
  const err = driverBehaviour.startAnalysis();
  if (!err) {
    showMessage('Starting analysis failed.', 5000);
  }
}

function onStopRecordingButtonPressed() {
  // Stop recording analysis of driver behaviour
  recordedAnalysis = driverBehaviour.stopAnalysis();
  isAnalysing = false;
  updateUI();
}

function showAnalysisModal() {
  if (!driverBehaviour) return;
  const analyses = driverBehaviour.getAllDriverBehaviourAnalyses();
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.5); z-index: 3000; display: flex; align-items: center; justify-content: center;
  `;
  const panel = document.createElement('div');
  panel.style.cssText = `
    background: #fff; border-radius: 12px; padding: 24px; max-width: 600px; width: 90vw; max-height: 80vh; overflow-y: auto;
    box-shadow: 0 2px 20px rgba(0,0,0,0.3);
  `;
  panel.innerHTML = `<h2 style="margin-top:0;">Analyses</h2>`;
  if (!analyses || analyses.length === 0) {
    panel.innerHTML += `<div>No analyses recorded</div>`;
  } else {
    analyses.forEach((a: DriverBehaviourAnalysis, i: number) => {
      if (!a.isValid) {
        panel.innerHTML += `<div style="margin-bottom:12px;"><b>Trip ${i + 1}:</b> Invalid analysis</div>`;
        return;
      }
      const start = new Date(a.startTime).toLocaleString();
      const end = new Date(a.finishTime).toLocaleString();
      const dur = ((a.finishTime - a.startTime) / 1000 / 60).toFixed(1) + ' min';
      panel.innerHTML += `
        <details style="margin-bottom:12px;">
          <summary><b>Trip ${i + 1}</b> <span style="font-size:0.9em;color:#666;">${start}</span></summary>
          <div style="margin-top:8px;">
            <div><b>Start:</b> ${start}</div>
            <div><b>End:</b> ${end}</div>
            <div><b>Duration:</b> ${dur}</div>
            <div><b>Distance (km):</b> ${a.kilometersDriven?.toFixed(2)}</div>
            <div><b>Driving Time (min):</b> ${a.minutesDriven?.toFixed(1)}</div>
            <div><b>Total Elapsed (min):</b> ${a.minutesTotalElapsed?.toFixed(1)}</div>
            <div><b>Speeding (min):</b> ${a.minutesSpeeding?.toFixed(1)}</div>
            <div><b>Risk Mean Speed (%):</b> ${Math.round(a.riskRelatedToMeanSpeed * 100)}%</div>
            <div><b>Risk Speed Var (%):</b> ${Math.round(a.riskRelatedToSpeedVariation * 100)}%</div>
            <div style="margin-top:8px;font-weight:bold;">Events:</div>
            <div><b>Harsh Accel:</b> ${a.numberOfHarshAccelerationEvents}</div>
            <div><b>Harsh Braking:</b> ${a.numberOfHarshBrakingEvents}</div>
            <div><b>Cornering:</b> ${a.numberOfCorneringEvents}</div>
            <div><b>Swerving:</b> ${a.numberOfSwervingEvents}</div>
            <div><b>Ignored Stops:</b> ${a.numberOfIgnoredStopSigns}</div>
            <div><b>Stop Signs:</b> ${a.numberOfEncounteredStopSigns}</div>
          </div>
        </details>
      `;
    });
  }
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = `
    margin-top: 12px; padding: 8px 20px; background: #673ab7; color: #fff; border: none; border-radius: 8px; font-size: 1em; cursor: pointer;
  `;
  closeBtn.onclick = () => document.body.removeChild(modal);
  panel.appendChild(closeBtn);
  modal.appendChild(panel);
  modal.onclick = (e) => {
    if (e.target === modal) document.body.removeChild(modal);
  };
  document.body.appendChild(modal);
}

window.addEventListener('DOMContentLoaded', async () => {
  let gemKit;
  try {
    gemKit = await GemKit.initialize(GEMKIT_TOKEN);
  } catch (error) {
    showMessage('Failed to initialize GemKit SDK. Please check your token.', 5000);
    console.error('GemKit initialization error:', error);
    return;
  }
  await PositionService.instance;

  const container = document.getElementById('map-container');
  if (!container) throw new Error('Map container not found');

  const viewId = 2;
  const wrapper = gemKit.createView(viewId, onMapCreated);
  if (wrapper) container.appendChild(wrapper);

  // Record button
  recordBtn = document.createElement('button');
  recordBtn.textContent = 'Start Analysis';
  recordBtn.style.cssText = `
    position: fixed; top: 20px; right: 20px; padding: 12px 20px;
    background: #e53935; color: #fff; border: none; border-radius: 8px;
    font-size: 1em; font-weight: 500; cursor: pointer; z-index: 2000; display: none;
  `;
  recordBtn.onclick = onRecordButtonPressed;
  document.body.appendChild(recordBtn);

  // Stop button
  stopBtn = document.createElement('button');
  stopBtn.textContent = 'Stop Analysis';
  stopBtn.style.cssText = `
    position: fixed; top: 20px; right: 160px; padding: 12px 20px;
    background: #fbc02d; color: #fff; border: none; border-radius: 8px;
    font-size: 1em; font-weight: 500; cursor: pointer; z-index: 2000; display: none;
  `;
  stopBtn.onclick = onStopRecordingButtonPressed;
  document.body.appendChild(stopBtn);

  // Follow Position button
  followBtn = document.createElement('button');
  followBtn.textContent = 'Follow Position';
  followBtn.style.cssText = `
    position: fixed; top: 20px; right: 300px; padding: 12px 20px;
    background: #673ab7; color: #fff; border: none; border-radius: 8px;
    font-size: 1em; font-weight: 500; cursor: pointer; z-index: 2000;
  `;
  followBtn.onclick = onFollowPositionButtonPressed;
  document.body.appendChild(followBtn);

  // View Analysis button
  viewAnalysisBtn = document.createElement('button');
  viewAnalysisBtn.textContent = 'View Analysis';
  viewAnalysisBtn.style.cssText = `
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    background: #2196f3; color: #fff; border: none; border-radius: 8px;
    font-size: 1em; font-weight: 500; cursor: pointer; z-index: 2000; display: none;
  `;
  viewAnalysisBtn.onclick = showAnalysisModal;
  document.body.appendChild(viewAnalysisBtn);

  updateUI();
});
