let express = require('express');
let steem = require('../modules/steemconnect')
let router = express.Router();
var getSlug = require('speakingurl');
var config = require('../config');

let Blogs = require('../database/blogs.js');

function isLoggedAndConfigured(req, res, next) {

    if (req.session.steemconnect) {
        Blogs.findOne({steem_username: req.session.steemconnect.name}, function (err, blogger) {
            if(blogger) {
                req.session.blogger = blogger;
                if(!blogger.tier) {
                    res.redirect('/configure');
                } else if(!blogger.configured) {
                    if(req.path == '/configure') {
                        return next();
                    } else {
                        res.redirect('/dashboard/configure');
                    }                    
                } else {
                    return next();
                }   
            } else {
                res.redirect('/');
            }
        })
    } else {
        res.redirect('/');
    }
}

router.get('/configure', isLoggedAndConfigured, (req, res) => {
    if(!req.session.blogger.configured) {
        res.render('dashboard/configure.pug', {blogger: req.session.blogger, url: 'configure'});
    } else {
        res.redirect('/dashboard');
    }
    
});

router.get('/', isLoggedAndConfigured, (req, res) => {
    res.render('dashboard/main.pug', {blogger: req.session.blogger, url: '/'});
});

router.get('/profile', isLoggedAndConfigured, (req, res) => {
    res.render('dashboard/profile.pug', {blogger: req.session.blogger, url: 'profile'}); 
});

router.get('/settings', isLoggedAndConfigured, (req, res) => {
    res.render('dashboard/settings.pug', {blogger: req.session.blogger, url: 'settings'}); 
});

router.get('/write', isLoggedAndConfigured, (req, res) => {
    res.render('dashboard/write.pug', {blogger: req.session.blogger, url: 'write'}); 
});

router.get('/notifications', isLoggedAndConfigured, (req, res) => {
    res.render('dashboard/notifications.pug', {blogger: req.session.blogger, url: 'notifications'}); 
});

router.get('/posts', isLoggedAndConfigured, (req, res) => {
    res.render('dashboard/posts.pug', {blogger: req.session.blogger, url: 'posts'}); 
});

router.get('/wallet', isLoggedAndConfigured, (req, res) => {
    res.render('dashboard/wallet.pug', {blogger: req.session.blogger, url: 'wallet'}); 
});

router.get('/upgrade', isLoggedAndConfigured, (req, res) => {
    res.render('dashboard/upgrade.pug', {blogger: req.session.blogger, url: 'upgrade'}); 
});



/////// POST REQUESTS

router.post('/publish', (req, res) => {
    
    let article = req.body;
    console.log(article);

    if(article.body != '' && article.title != '') {

        var permlink = getSlug(article.title);

        console.log(article.category, article.tags);

        const operations = [ 
            ['comment', 
              { 
                parent_author: "", 
                parent_permlink: 'test2', 
                author: req.session.steemconnect.name, 
                permlink: permlink, 
                title: article.title, 
                body: article.body, 
                json_metadata : JSON.stringify({ 
                  tags: ['test2'], 
                  app: `engrave/0.1` 
                }) 
              } 
            ], 
            ['comment_options', { 
              author: req.session.steemconnect.name, 
              permlink: permlink, 
              max_accepted_payout: '1000000.000 SBD', 
              percent_steem_dollars: 10000, 
              allow_votes: true, 
              allow_curation_rewards: true, 
              extensions: [ 
                [0, { 
                  beneficiaries: [ 
                    { account: 'nicniezgrublem', weight: 1000 }
                  ] 
                }] 
              ] 
            }] 
          ];

        steem.broadcast(operations, function (err, result) {
            if(err) {
                console.log(err);
                var errorstring = err.error_description.split('\n')[0].split(': ')[1];
                if(errorstring == 'Comment already has beneficiaries specified.') {
                    res.json({ error: 'Artykuł o podanym tytule już istnieje!'});
                } else {
                    res.json({ error: errorstring});
                }
                
            } else {
                console.log("Article posted on steem");
                res.json({ success: "Artykuł został opublikowany"});
            }
        });
    }

}); 

router.post('/configure/finish', (req, res) => {
    
    let configuration = req.body;

    Blogs.findOne({steem_username: req.session.steemconnect.name}, function(err, blog) {
        if(!err && blog) {
            if(!blog.configured) {
                blog.configured = true;
                blog.email = configuration.email;
                if(blog.tier == 5) {
                    blog.domain = req.session.steemconnect.name + '.' + config.domain;
                } else if (blog.tier == 10 || blog.tier == 15) {
                    blog.domain = configuration.domain;
                }

                blog.save(function(err) {
                    if(err) {
                        console.log(err);
                        res.json({ error: "Wystąpił błąd podczas konfiguracji"});
                    } else {
                        res.json({ success: "Konfiguracja zakończona!"});
                    }
                });
                
            } else {
                res.json({ error: "Już skonfigurowano! Nie oszukuj!"});
            }
        } else {
            res.json({ error: "Wystąpił błąd podczas konfiguracji"});
        }
    });

    console.log(configuration);
}); 

router.post('/settings', isLoggedAndConfigured, (req, res) => {
    
    let settings = req.body;

    console.log(settings);

    Blogs.findOne({steem_username: req.session.steemconnect.name}, function(err, blog) {
        if(!err && blog) {
            copySettings(settings, blog);
            blog.save(function(err){
                if(!err) {
                    res.json({ success: "Ustawienia zapisane poprawnie"});
                } else {
                    res.json({ error: "Wystąpił jakiś błąd..."});
                }
            })
        } else {
            res.json({ error: "Wystąpił jakiś błąd..."});
        }
    });    
}); 

router.post('/profile', isLoggedAndConfigured, (req, res) => {
    
    let profile = req.body;

    console.log(profile);

    Blogs.findOne({steem_username: req.session.steemconnect.name}, function(err, blog) {
        if(!err && blog) {
            blog.author_name = profile.author_name;
            blog.author_surname = profile.author_surname;
            blog.author_bio = profile.author_bio;
            blog.author_image_url = profile.author_image_url;
            // blog.email = profile.email
            blog.save(function(err){
                if(!err) {
                    res.json({ success: "Ustawienia zapisane poprawnie"});
                } else {
                    res.json({ error: "Wystąpił jakiś błąd..."});
                }
            })
        } else {
            res.json({ error: "Wystąpił jakiś błąd..."});
        }
    });    
}); 

function copySettings(new_settings, oldsettings) {
    oldsettings.blog_title = new_settings.blog_title
    oldsettings.blog_slogan = new_settings.blog_slogan;
    oldsettings.blog_logo_url = new_settings.blog_logo_url;
    oldsettings.theme = new_settings.theme;
    oldsettings.frontpage_language = new_settings.frontpage_language;
    oldsettings.posts_per_category_page = new_settings.posts_per_category_page;
    oldsettings.load_more_posts_quantity = new_settings.load_more_posts_quantity;
    // oldsettings.show_only_categorized_posts = new_settings.show_only_categorized_posts;
    oldsettings.opengraph_default_description = new_settings.opengraph_default_description;
    oldsettings.opengraph_default_image_url = new_settings.opengraph_default_image_url;
    oldsettings.onesignal_app_id = new_settings.onesignal_app_id;
    oldsettings.onesignal_api_key = new_settings.onesignal_api_key;
    oldsettings.onesignal_logo_url = new_settings.onesignal_logo_url;
    oldsettings.onesignal_body_length = new_settings.onesignal_body_length;
    oldsettings.analytics_gtag = new_settings.analytics_gtag;
    oldsettings.webmastertools_id = new_settings.webmastertools_id;
}

module.exports = router;