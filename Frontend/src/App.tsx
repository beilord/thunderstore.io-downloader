import './App.css';
import { useState } from 'react';
import Warning from './components/Warning';
import Modpack from './components/Modpack';
import { getMods, getModDownloadUrl } from './utils/mods';
import JSZip from 'jszip';

interface AppState {
  mode: 'search' | 'download' | 'redownload';
}

export interface Mod {
  title: string | null | undefined;
  url: string | null | undefined;
}

interface ModBlob {
  title: string;
  blob: Blob;
}

const downloadFile = (file: Blob) => {
  setTimeout(() => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = 'Modpack.zip';
    a.click();

    URL.revokeObjectURL(a.href);
  }, 1500);
};

const generateZip = async(modlist: ModBlob[]): Promise<Blob> => {
  const zip = new JSZip();

  modlist.forEach(({ title, blob }) => zip.file(`${title}.zip`, blob));

  return await zip.generateAsync({ type: 'blob' });
};

function App() {
  const [appState, setAppState] = useState<AppState>({ mode: 'search' });
  const [input, setInput] = useState('');
  const [showWarning, setShowWarning] = useState(true);
  const [modList, setModList] = useState<Mod[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadedMods, setDownloadedMods] = useState<ModBlob[]>([]);
  const [errors, setErrors] = useState<{ title: string, error: string }[]>([]);

  const handleSearch = async(e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input) return;

    setLoading(prev => !prev);
    setShowWarning(false);
    setModList([]);

    const [mods, { error, message }] = await getMods(input);

    if (error) {
      setLoading(prev => !prev);
      console.warn({ error, message });
      return;
    }

    setModList(mods);
    setLoading(prev => !prev);
    setAppState({ mode: 'download' });
  };

  const handleDownloadModpack = async() => {
    if (!modList.length) return;
    if (isDownloading) return;

    setIsDownloading(prev => !prev);

    const promises = modList.map(async(mod) => {
      const { title, url } = mod;
      if (!url || !title) return null;

      const { url: downloadUrl } = await getModDownloadUrl(mod);
      if (!downloadUrl) return null;

      const searchParams = new URLSearchParams({ thunderstore_url: downloadUrl });
      return fetch(`http://localhost:3000/api/getmod?${searchParams}`, { signal: AbortSignal.timeout(8000) })
        .then(res => res.blob())
        .then(blob => {
          setDownloadedMods(prev => [...prev, { title, blob }]);
        })
        .catch(err => {
          setErrors(prev => [...prev, { title, error: err.message }]);
          return null;
        })
        .finally(() => {
          console.log('Promesa Finalizada');
          setDownloadProgress(prev => prev + Math.trunc((1 / modList.length) * 100));
        });
    });

    // // TESTING PROMISE
    // promises.push(new Promise(resolve => setTimeout(resolve, 5000)));

    await Promise.allSettled(promises);
    setIsDownloading(prev => !prev);
    setAppState({ mode: 'redownload' });
    const zip = await generateZip(downloadedMods);
    downloadFile(zip);
  };

  const handleReDownloadModpack = async() => {
    setDownloadedMods([]);
    setErrors([]);
    setDownloadProgress(0);
    handleDownloadModpack();
  };

  return (
    <>
      <main>
        <section className='search'>
          <form onSubmit={handleSearch} className='searchForm'>
            <label htmlFor="search">Insert the URL to the modpack you want to download</label>
            <div>
              <input
                type="text"
                id='search'
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Example: https://thunderstore.io/c/lethal-company/p/Momo/MomoChillPack/'
              />
              <button type='submit'>
                <img src="./src/assets/searchButton.svg" alt="Search button" width={30} />
              </button>
            </div>
          </form>
          {
            loading
              && <img src="./src/assets/loading.svg" alt="Loading" width={50} className='loading'/>
          }
          {
            appState.mode === 'download'
              && <button className='downloadAll' onClick={handleDownloadModpack}>Download the entire modpack</button>
          }
          {
            appState.mode === 'redownload'
              && <p className='downloadCompleted'>Download Completed</p>
          }
          {
            appState.mode === 'redownload'
              && <button className='reDownloadAll' onClick={handleReDownloadModpack}>Re-download</button>
          }
          {
            isDownloading
              && <p className='downloadProgress'>Download progress: {downloadProgress}%</p>
          }
          {
            errors.length > 0 && (
              <ul className='errors'>
                {errors.map(({ title }) => (
                  <li key={title}>{title}</li>
                ))}
              </ul>
            )
          }
        </section>
        {
          modList.length < 1
            ? showWarning && <Warning />
            : <Modpack mods={modList} />
        }
      </main>
      <footer>
        <h3>Thunderstore.io Modpack Downloader</h3>
        <p>Made with 💖 by <a href="https://github.com/0xErrebe">0xErrebe</a></p>
        <a href="https://github.com/0xErrebe/thunderstore.io-downloader">Project Repo</a>
      </footer>
    </>
  );
}

export default App;