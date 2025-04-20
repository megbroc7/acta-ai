import PostDetail from './pages/posts/PostDetail';

          {/* Blog Posts */}
          <Route path="/posts" element={<PostsList />} />
          <Route path="/posts/:id" element={<PostDetail />} /> 