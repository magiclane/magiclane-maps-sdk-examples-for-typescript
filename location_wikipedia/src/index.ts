// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Contact Magic Lane at <info@magiclane.com> for SDK licensing options.

import {
  GemKit,
  GemMap,
  Coordinates,
  SearchService,
  ExternalInfoService,
  ExternalInfo,
  Landmark,
  PositionService,
  GemError,
} from '@magiclane/maps-sdk';
import { GEMKIT_TOKEN, showMessage, ICONS } from '../../shared';

// Main UI
let map: GemMap | null = null;
let wikiBtn: HTMLButtonElement;
let wikiModal: HTMLDivElement | null = null;

async function onMapCreated(gemMap: GemMap) {
  map = gemMap;
}

function showWikipediaModal(title: string, content: string, imageUrl?: string) {
  if (wikiModal) document.body.removeChild(wikiModal);
  wikiModal = document.createElement('div');
  wikiModal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.6); z-index: 3000; display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(4px);
  `;
  const panel = document.createElement('div');
  panel.style.cssText = `
    background: rgba(255, 255, 255, 0.98); border-radius: 20px; padding: 30px; max-width: 600px; width: 90vw; max-height: 80vh; overflow-y: auto;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    display: flex; flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  `;
  // Add header with close button
  const header = document.createElement('div');
  header.style.cssText =
    'display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 20px;';
  const titleElem = document.createElement('h2');
  titleElem.textContent = title;
  titleElem.style.cssText = 'margin: 0; color: #333; font-size: 24px; font-weight: 700;';
  const closeIconBtn = document.createElement('button');
  closeIconBtn.innerHTML = ICONS.close;
  closeIconBtn.style.cssText = `
    background: transparent; border: none; cursor: pointer; color: #666; display: flex; padding: 4px; border-radius: 50%; transition: background 0.2s;
  `;
  closeIconBtn.onmouseenter = () => (closeIconBtn.style.background = '#f0f0f0');
  closeIconBtn.onmouseleave = () => (closeIconBtn.style.background = 'transparent');
  closeIconBtn.onclick = () => {
    if (wikiModal) document.body.removeChild(wikiModal);
    wikiModal = null;
  };
  header.appendChild(titleElem);
  header.appendChild(closeIconBtn);
  panel.appendChild(header);

  if (imageUrl) {
    const imgContainer = document.createElement('div');
    imgContainer.style.cssText =
      'width: 100%; border-radius: 12px; overflow: hidden; margin-bottom: 20px; border: 1px solid #eee;';
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = title;
    img.style.cssText = 'width: 100%; max-height: 300px; object-fit: cover; display: block;';
    imgContainer.appendChild(img);
    panel.appendChild(imgContainer);
  }
  const contentElem = document.createElement('div');
  contentElem.style.cssText = 'font-size: 16px; line-height: 1.6; color: #555; width: 100%;';
  contentElem.innerHTML = content;
  panel.appendChild(contentElem);
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = `
    margin-top: 20px; padding: 12px 32px; background: #673ab7; color: #fff; border: none; border-radius: 50px; font-size: 16px; cursor: pointer;
    font-weight: 600; box-shadow: 0 4px 15px rgba(103, 58, 183, 0.4); transition: all 0.2s;
  `;
  closeBtn.onmouseenter = () => {
    closeBtn.style.transform = 'translateY(-2px)';
    closeBtn.style.boxShadow = '0 6px 20px rgba(103, 58, 183, 0.6)';
    closeBtn.style.background = '#7e57c2';
  };
  closeBtn.onmouseleave = () => {
    closeBtn.style.transform = 'translateY(0)';
    closeBtn.style.boxShadow = '0 4px 15px rgba(103, 58, 183, 0.4)';
    closeBtn.style.background = '#673ab7';
  };
  closeBtn.onclick = () => {
    if (wikiModal) document.body.removeChild(wikiModal);
    wikiModal = null;
  };
  panel.appendChild(closeBtn);
  wikiModal.appendChild(panel);
  wikiModal.onclick = (e) => {
    if (e.target === wikiModal && wikiModal) {
      document.body.removeChild(wikiModal);
      wikiModal = null;
    }
  };
  document.body.appendChild(wikiModal);
}

async function onLocationWikipediaTap() {
  showMessage('Searching Wikipedia info...');
  const searchResult = await new Promise<Landmark[]>((resolve) => {
    SearchService.search({
      textFilter: 'Statue of Liberty',
      referenceCoordinates: new Coordinates({ latitude: 40.53859, longitude: -73.91619 }),
      onCompleteCallback: (err: GemError, lmks: Landmark[]) => resolve(lmks),
    });
  });

  const lmk = searchResult[0];
  if (!ExternalInfoService.hasWikiInfo(lmk)) {
    showWikipediaModal('Wikipedia info not available', 'The landmark does not have Wikipedia info');
    return;
  }

  const externalInfo = await new Promise<ExternalInfo | null>((resolve) => {
    ExternalInfoService.requestWikiInfo(lmk, (err: GemError, info: ExternalInfo | null) =>
      resolve(info)
    );
  });

  if (!externalInfo) {
    showWikipediaModal('Query failed', 'The request to Wikipedia failed');
    return;
  }
  // Optionally request image info (not used for display here)
  externalInfo.requestWikiImageInfo(0, (error, imageInfo) => {
    console.log('Wiki image info received:', error, imageInfo);
  });
  const imageUrl = externalInfo.getWikiImageUrl(0);
  showWikipediaModal(externalInfo.wikiPageTitle, externalInfo.wikiPageDescription, imageUrl);
}

window.addEventListener('DOMContentLoaded', async () => {
  let gemKit: GemKit;
  try {
    gemKit = await GemKit.initialize(GEMKIT_TOKEN);
    await PositionService.instance;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    showMessage(`SDK initialization failed: ${message}`, 5000);
    console.error('SDK initialization failed:', error);
    return;
  }

  const container = document.getElementById('map-container');
  if (!container) throw new Error('Map container not found');

  const viewId = 2;
  const wrapper = gemKit.createView(viewId, onMapCreated);
  if (wrapper) container.appendChild(wrapper);

  // Wikipedia button
  wikiBtn = document.createElement('button');
  wikiBtn.innerHTML = `${ICONS.search} Wikipedia`;
  wikiBtn.className = 'gem-button gem-button-primary gem-button-center';
  wikiBtn.onclick = onLocationWikipediaTap;
  document.body.appendChild(wikiBtn);
});
