import { PostValidators } from './../../validators/PostValidators';
import { ICategory } from './../../database/helpers/ICategory';
import { Blogs } from './../../database/BlogsModel';
import { Utils } from '../../modules/Utils'
import { IExtendedRequest } from '../IExtendedRequest';
import * as express from 'express';
import { GetValidators } from '../../validators/GetValidators';


let router = express.Router();

router.get('/settings', GetValidators.isLoggedAndConfigured, (req: IExtendedRequest, res: express.Response) => {
    res.render('dashboard/settings.pug', { blogger: req.session.blogger, url: 'settings' });
});

router.post('/settings', PostValidators.isLoggedAndConfigured, async (req: IExtendedRequest, res: express.Response) => {

    try {
        let newSettings = req.body;
        let tempCategories = [];
        let categories: ICategory[] = [];

        for (var key in newSettings) {
            if (key.match(/(c_)([0-9]*)(_name)+/)) {
                tempCategories.push({ name: key, value: newSettings[key] });
            }
        }

        tempCategories.forEach(singleCategory => {
            let id = singleCategory.name.replace('c_', "").replace('_name', "");
            let slug_reg = new RegExp('(c_)(' + id + ')(_slug)', "i");
            let steem_tag_reg = new RegExp('(c_)(' + id + ')(_steem_tag)', "i");

            let slug = null;
            let steem_tag = null;

            for (var key in newSettings) {
                if (key.match(slug_reg)) {
                    slug = newSettings[key];
                }
            }

            for (var key in newSettings) {
                if (key.match(steem_tag_reg)) {
                    steem_tag = newSettings[key];
                }
            }

            for (let category of categories) {
                if (category.slug == slug || category.steem_tag == steem_tag) throw new Error('You can\'t set categories with repeated slug or Steem tag')
            }

            categories.push({
                steem_tag: steem_tag,
                slug: slug,
                name: singleCategory.value
            })
        })

        if (!categories.length) {
            res.json({ error: "Add at least one category" });
        } else {
            newSettings.categories = categories;
            let blog = await Blogs.findOne({ steem_username: req.session.steemconnect.name });
            Utils.CopySettings(newSettings, blog);
            await blog.save();
            req.session.blogger = blog;
            res.json({ success: "Settings saved successfully" });
        }
    } catch (error) {
        res.json({ error: error.message });
    }


});

module.exports = router;