import React from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { ChevronLeft, Calendar, Tag, Share2, Facebook, Twitter, Linkedin } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SEO from '@/components/SEO';
import { blogPosts } from './blogData';

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = blogPosts.find(p => p.id === slug);

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  const shareUrl = typeof window !== 'undefined' ? window.location.href : `https://www.aaroksha.in/blog/${post.id}`;

  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": shareUrl
    },
    "headline": post.title,
    "description": post.description,
    "image": post.image,
    "author": {
      "@type": "Organization",
      "name": "Aaroksha Health Hub",
      "url": "https://www.aaroksha.in"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Aaroksha Health Hub",
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.aaroksha.in/favicon.png"
      }
    },
    "datePublished": new Date(post.date).toISOString(),
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <SEO 
        title={`${post.title} | Aaroksha Blog`} 
        description={post.description}
        canonical={`/blog/${post.id}`}
        ogType="article"
        ogImage={post.image}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      
      <Header />

      <main className="flex-1">
        {/* Post Header */}
        <article className="bg-white border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-6 py-12 lg:py-16">
            <Link to="/blog" className="inline-flex items-center gap-1 text-sm font-bold text-slate-400 hover:text-blue-600 transition-colors mb-8">
              <ChevronLeft className="w-4 h-4" /> Back to Blog
            </Link>
            
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-100 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> {post.category}
              </span>
              <span className="text-slate-500 text-sm font-medium flex items-center gap-1.5 uppercase tracking-wider">
                <Calendar className="w-4 h-4" /> {post.date}
              </span>
            </div>
            
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 leading-[1.2] tracking-tight mb-8">
              {post.title}
            </h1>
            
            <div className="aspect-video w-full rounded-3xl overflow-hidden shadow-xl mb-12">
              <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
            </div>
            
            <div className="flex flex-col lg:flex-row gap-12">
              {/* Social Share sidebar */}
              <div className="lg:w-16 shrink-0 flex lg:flex-col gap-4 items-center border-b lg:border-b-0 lg:border-r border-slate-100 pb-6 lg:pb-0 lg:pr-6">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest lg:rotate-180 lg:[writing-mode:vertical-rl]">Share</span>
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-[#1877F2] hover:text-white hover:border-[#1877F2] transition-colors">
                  <Facebook className="w-4 h-4" />
                </a>
                <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(post.title)}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-[#1DA1F2] hover:text-white hover:border-[#1DA1F2] transition-colors">
                  <Twitter className="w-4 h-4" />
                </a>
                <a href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-[#0A66C2] hover:text-white hover:border-[#0A66C2] transition-colors">
                  <Linkedin className="w-4 h-4" />
                </a>
              </div>
              
              {/* Content */}
              <div className="flex-1 prose prose-lg prose-slate max-w-none prose-headings:font-black prose-p:font-medium prose-p:text-slate-600 prose-a:text-blue-600 hover:prose-a:text-blue-700" dangerouslySetInnerHTML={{ __html: post.content }} />
            </div>
          </div>
        </article>

        {/* Read More Section */}
        <section className="bg-slate-50 py-16">
          <div className="max-w-4xl mx-auto px-6">
            <h3 className="text-2xl font-black text-slate-900 mb-8">More from Aaroksha</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {blogPosts.filter(p => p.id !== post.id).slice(0, 2).map(related => (
                <Link key={related.id} to={`/blog/${related.id}`} className="bg-white rounded-2xl p-4 border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow group">
                  <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0">
                    <img src={related.image} alt={related.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm mb-1.5 line-clamp-2 group-hover:text-blue-600 transition-colors">{related.title}</h4>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{related.date}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default BlogPost;
