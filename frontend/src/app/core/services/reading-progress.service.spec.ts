import { TestBed } from '@angular/core/testing';
import { ReadingProgressService } from './reading-progress.service';

describe('ReadingProgressService', () => {
  beforeEach(() => {
    localStorage.removeItem('blog:reading');
    TestBed.configureTestingModule({});
  });

  afterEach(() => localStorage.removeItem('blog:reading'));

  it('saves progress and reloads it from storage', () => {
    TestBed.inject(ReadingProgressService).save('post', { progress: 0.4, headingId: 'cookies', headingText: 'Cookies' });
    const fresh = new ReadingProgressService();
    expect(fresh.get('post')?.progress).toBe(0.4);
    expect(fresh.get('post')?.headingId).toBe('cookies');
    expect(fresh.get('post')?.finished).toBe(false);
  });

  it('keeps a post finished after it is re-read from the top', () => {
    const service = TestBed.inject(ReadingProgressService);
    service.save('post', { progress: 1, finished: true });
    service.save('post', { progress: 0.1 });
    expect(service.get('post')?.finished).toBe(true);
    expect(service.get('post')?.progress).toBe(0.1);
  });

  it('ignores unreadable storage', () => {
    localStorage.setItem('blog:reading', '{not json');
    expect(new ReadingProgressService().states()).toEqual({});
  });
});
