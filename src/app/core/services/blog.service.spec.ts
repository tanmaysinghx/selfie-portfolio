import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { BlogService } from './blog.service';

describe('Keystone reactions', () => {
  let service: BlogService;
  let http: HttpTestingController;
  beforeEach(() => {
    localStorage.removeItem('blog:keystone-liked');
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(BlogService); http = TestBed.inject(HttpTestingController);
    http.expectOne('/posts/index.json').flush([]);
  });
  afterEach(() => { http.verify(); localStorage.removeItem('blog:keystone-liked'); });
  it('does not remember a failed like and allows a successful retry', async () => {
    const failed = service.like('example');
    const assertion = expect(failed).rejects.toBeTruthy();
    http.expectOne('/api/stats').flush({}, { status: 503, statusText: 'Unavailable' });
    await assertion;
    expect(service.hasLiked('example')).toBe(false);
    const retry = service.like('example');
    http.expectOne('/api/stats').flush({ views: 2, likes: 1, configured: true });
    await expect(retry).resolves.toEqual({ views: 2, likes: 1, configured: true });
    expect(service.hasLiked('example')).toBe(true);
  });
  it('rejects an unconfigured response or SPA fallback instead of claiming success', async () => {
    for (const response of [{ views: 0, likes: 0, configured: false }, '<html>fallback</html>']) {
      const pending = service.like('example'); const assertion = expect(pending).rejects.toThrow('Reactions unavailable');
      http.expectOne('/api/stats').flush(response); await assertion;
      expect(service.hasLiked('example')).toBe(false);
    }
  });
});
