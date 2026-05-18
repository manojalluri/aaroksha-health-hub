import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Calendar, Tag } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SEO from '@/components/SEO';
import { blogPosts } from './blogData';

const BlogIndex = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <SEO 
        title="Healthcare Blog | Aaroksha Bhimavaram" 
        description="Read the latest healthcare tips, news, and updates from Aaroksha, Bhimavaram's leading digital health platform."
        canonical="/blog"
      />
      <Header />

      <main className="flex-1 py-12 lg:py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h1 className="text-4xl lg:text-5xl font-black text-slate-900 mb-4 tracking-tight">Aaroksha Health Blog</h1>
            <p className="text-lg text-slate-600 font-medium max-w-2xl mx-auto">
              Your source for the latest medical insights, wellness tips, and platform updates in Bhimavaram.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map((post) => (
              <article key={post.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col">
                <Link to={`/blog/${post.id}`} className="block relative aspect-[4/3] overflow-hidden group">
                  <div className="absolute inset-0 bg-slate-900/10 group-hover:bg-transparent transition-colors z-10" />
                  <img 
                    src={post.image} 
                    alt={post.title} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <span className="absolute top-4 left-4 z-20 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-blue-600 shadow-sm flex items-center gap-1.5">
                    <Tag className="w-3 h-3" /> {post.category}
                  </span>
                </Link>
                
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-bold mb-3 uppercase tracking-wider">
                    <Calendar className="w-3.5 h-3.5" />
                    {post.date}
                  </div>
                  
                  <h2 className="text-xl font-black text-slate-900 mb-3 leading-snug line-clamp-2">
                    <Link to={`/blog/${post.id}`} className="hover:text-blue-600 transition-colors">
                      {post.title}
                    </Link>
                  </h2>
                  
                  <p className="text-slate-500 text-sm mb-6 line-clamp-3 font-medium flex-1">
                    {post.description}
                  </p>
                  
                  <Link 
                    to={`/blog/${post.id}`} 
                    className="inline-flex items-center gap-1.5 text-blue-600 font-bold text-sm hover:text-blue-700 transition-colors mt-auto"
                  >
                    Read Article <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default BlogIndex;
